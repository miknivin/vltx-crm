import { generateObject, streamText, type ModelMessage } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { isAuthenticatedUser, authorizeRoles } from "../../middlewares/auth";
import prisma from "@/app/lib/db/prisma";
import { PLANNER_PROMPT, EXPLAINER_PROMPT } from "@/app/lib/ai/pipelinePrompt";
import {
  validatePipeline,
  ensureColumnsCoverFilters,
  DEFAULT_COLUMNS,
} from "@/app/lib/ai/toolSpecs";

import { executeFindQuery } from "@/helpers/executeFindQuery";
import { executeAggregateQuery } from "@/helpers/executeAggregateQuery";
import { resolveDisplayNames } from "@/helpers/resolveAiDisplayNames";

const PLANNER_MODEL = "openai/gpt-4.1";
const EXPLAINER_MODEL = "openai/gpt-4.1";
const MAX_CONTEXT_TURNS = 6;
const MAX_ROWS_PER_STEP = 200;
const SAMPLE_ROWS_FOR_EXPLAINER = 5;

// ── Plan schema ──────────────────────────────────────────────────────
// Shape-level validation only; semantic validation (method names, arg
// counts/types, field allowlist) happens in validatePipeline afterwards, with
// one repair retry on failure.

const ActionArgValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

const ActionSchema = z.object({
  method: z.string(),
  args: z.array(ActionArgValueSchema).optional(),
});

const UiSchema = z.object({
  type: z.enum(["table", "stat_card", "stat_table", "chart_trend"]).default("table"),
  title: z.string().nullable().optional(),
});

const StepArgsSchema = z.object({
  filterActions: z.array(ActionSchema).default([]),
  aggregateActions: z.array(ActionSchema).default([]),
  /// Display columns, replacing the Mongo projection. The query always
  /// returns the full record, so this can never hide a field the explainer
  /// needs — only what the table shows.
  columns: z.array(z.string()).nullable().optional(),
  sort: z.record(z.number()).nullable().optional(),
  limit: z.number().nullable().optional(),
  ui: UiSchema.default({ type: "table" }),
});

const PlanStepSchema = z.object({
  tool: z.enum(["findEnquiries", "aggregateEnquiries"]),
  purpose: z.string().default(""),
  args: StepArgsSchema,
});

const PipelineSchema = z.object({
  outcome: z.enum(["ok", "unsupported", "needs_clarification"]).default("ok"),
  steps: z.array(PlanStepSchema).max(3).default([]),
});

type Pipeline = z.infer<typeof PipelineSchema>;

// ── Helpers ──────────────────────────────────────────────────────────

async function authenticate(request: NextRequest) {
  const currentUser = await isAuthenticatedUser(request);
  authorizeRoles(currentUser, "admin", "team_member");
  return { currentUser };
}

function normalizeSessionId(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return randomUUID();
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || randomUUID();
}

async function buildConversationMessages(
  sessionId: string,
  userId: string,
  newQuery: string
): Promise<ModelMessage[]> {
  const priorRows = await prisma.aiReportSessionMessage.findMany({
    where: { userId, session: { sessionId } },
    orderBy: { createdAt: "desc" },
    take: MAX_CONTEXT_TURNS,
    select: { queryTextInternal: true, queryText: true, toolRequest: true },
  });

  const chronological = [...priorRows].reverse();

  const history: ModelMessage[] = chronological.flatMap((row) => [
    { role: "user", content: row.queryTextInternal || row.queryText },
    { role: "assistant", content: JSON.stringify(row.toolRequest) },
  ]);

  return [...history, { role: "user", content: newQuery }];
}

type NormalizedStep = ReturnType<typeof normalizeStep>;

/**
 * Turn a validated plan step into the executable shape shared with
 * executeFindQuery / executeAggregateQuery and the response renderer.
 */
function normalizeStep(planStep: z.infer<typeof PlanStepSchema>, index: number) {
  const args = planStep.args;
  const isFind = planStep.tool === "findEnquiries";

  const step = {
    id: `step-${index + 1}`,
    type: isFind ? "find" : "aggregate",
    toolName: planStep.tool,
    purpose: planStep.purpose,
    filterActions: isFind ? (args.filterActions ?? []) : [],
    aggregateActions: isFind ? [] : (args.aggregateActions ?? []),
    columns: args.columns?.length ? args.columns : isFind ? [...DEFAULT_COLUMNS] : null,
    sort: args.sort ?? (isFind ? { createdAt: -1 } : null),
    // Only honoured when the model explicitly set it (top/first N requests).
    limit: typeof args.limit === "number" ? args.limit : null,
    ui: {
      type: args.ui?.type ?? (isFind ? "table" : "stat_table"),
      title: args.ui?.title ?? null,
    },
  };

  // The "main rule": every filtered field must be visible in the result.
  ensureColumnsCoverFilters(step);

  return step;
}

function serializeForStorage(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recursively drop id-ish values so raw UUIDs never reach the explainer and
 * end up quoted back at the user. Group rows carry their own `label`, so
 * nothing readable is lost.
 */
function stripIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripIds);
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === "string" && UUID_LIKE.test(val)) continue;
      if (key === "_id" || key === "id" || key === "customerId" || key === "sourceId") continue;
      next[key] = stripIds(val);
    }
    return next;
  }
  return value;
}

/** Compact per-step summary for the explainer — never the full dataset. */
function summarizeResult(step: NormalizedStep, rows: unknown[], totalCount: number) {
  return {
    purpose: step.purpose || step.ui?.title || step.toolName,
    tool: step.toolName,
    rowCount: totalCount,
    rowsShownToUser: rows.length,
    columns: step.columns,
    sampleRows: rows.slice(0, SAMPLE_ROWS_FOR_EXPLAINER).map((row) => {
      const compact = { ...(row as Record<string, unknown>) };
      delete compact.remarks;
      delete compact.photos;
      return stripIds(compact);
    }),
  };
}

// ── Route ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticate>>;
  let userQueryInternal: string;
  let userQueryDisplay: string;
  let sessionId: string;

  // Auth/body problems surface as plain JSON status responses — the stream
  // only starts once the request is actually runnable.
  try {
    auth = await authenticate(request);

    const body = await request.json();
    userQueryInternal = body.query?.trim();
    userQueryDisplay = body.queryDisplay?.trim() || userQueryInternal;
    sessionId = normalizeSessionId(body.sessionId);

    if (!userQueryInternal) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[AI Run Auth Error]", err);
    if (message.includes("login") || message.includes("not found")) {
      return NextResponse.json({ error: "Authentication required", message }, { status: 401 });
    }
    if (message === "Not allowed") {
      return NextResponse.json({ error: "Forbidden", message }, { status: 403 });
    }
    return NextResponse.json({ error: "Bad request", message }, { status: 400 });
  }

  const { currentUser } = auth;
  // An admin sees everything; a team member's answers are scoped to the
  // enquiries assigned to them, applied inside the executors before any
  // planned filter runs.
  const scopeUserId = currentUser.role === "admin" ? null : currentUser.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected — stop emitting; the flow below bails out via
          // `closed` checks and the message is not persisted.
          closed = true;
        }
      };

      try {
        emit("session", { sessionId });

        // ── PLAN ─────────────────────────────────────────────────
        const messages = await buildConversationMessages(
          sessionId,
          currentUser.id,
          userQueryInternal
        );
        const model = gateway(PLANNER_MODEL);

        let plan: Pipeline | null = null;
        let rawPlan: Pipeline | null = null;
        let issues: string[] = [];
        let planUsage: unknown = null;

        for (let attempt = 0; attempt < 2 && !plan; attempt++) {
          const attemptMessages: ModelMessage[] =
            attempt === 0 || !rawPlan
              ? messages
              : [
                  ...messages,
                  { role: "assistant", content: JSON.stringify(rawPlan) },
                  {
                    role: "user",
                    content: `Your pipeline failed validation:\n${issues.join("\n")}\nReturn a corrected pipeline.`,
                  },
                ];

          const result = await generateObject({
            model,
            system: PLANNER_PROMPT,
            messages: attemptMessages,
            schema: PipelineSchema,
            temperature: 0.15,
            // Strict JSON-schema mode rejects the z.record() sort map this
            // schema legitimately needs.
            providerOptions: { openai: { strictJsonSchema: false } },
          });

          rawPlan = PipelineSchema.parse(result.object);
          planUsage = result.usage;
          issues = validatePipeline(rawPlan);
          if (issues.length === 0) plan = rawPlan;
        }

        if (!plan) {
          emit("error", {
            message: `The AI could not produce a valid query plan. ${issues.slice(0, 3).join("; ")}`,
          });
          controller.close();
          return;
        }

        // A non-ok outcome never executes, so don't surface steps the model
        // contradictorily attached to it.
        const steps =
          plan.outcome === "ok"
            ? plan.steps.map((planStep, index) => normalizeStep(planStep, index))
            : [];

        emit("plan", {
          outcome: plan.outcome,
          steps: steps.map((step) => ({
            id: step.id,
            tool: step.toolName,
            purpose: step.purpose,
            ui: step.ui,
          })),
        });

        // ── EXECUTE ──────────────────────────────────────────────
        const results: Array<{
          id: string;
          step: NormalizedStep;
          data: unknown[];
          meta: { count: number };
        }> = [];
        const summaries: unknown[] = [];

        if (plan.outcome === "ok") {
          for (const step of steps) {
            if (closed) return;
            emit("step_start", { id: step.id });

            try {
              const data =
                step.toolName === "findEnquiries"
                  ? await executeFindQuery(step, scopeUserId, MAX_ROWS_PER_STEP)
                  : await executeAggregateQuery(step, scopeUserId);

              const plainRows = serializeForStorage(data) as Record<string, unknown>[];
              const cap = step.limit
                ? Math.min(step.limit, MAX_ROWS_PER_STEP)
                : MAX_ROWS_PER_STEP;
              // Ids stay ids for querying; anything leaving the backend for
              // the user speaks in names.
              const rows = await resolveDisplayNames(plainRows.slice(0, cap));
              const result = {
                id: step.id,
                step,
                data: rows,
                meta: { count: plainRows.length },
              };

              results.push(result);
              summaries.push(summarizeResult(step, rows, plainRows.length));
              emit("step_result", result);
            } catch (stepError: unknown) {
              console.error("[AI Step Error]", step.id, stepError);
              summaries.push({
                purpose: step.purpose,
                tool: step.toolName,
                error: "step failed to execute",
              });
              emit("step_error", { id: step.id, message: "This step failed to execute." });
            }
          }
        }

        // ── EXPLAIN ──────────────────────────────────────────────
        let explanation = "";

        if (!closed) {
          const explainerInput = {
            // Display form of the question (@users:Name, not @users:<id>) so
            // the explainer talks in names — raw ids never reach it.
            question: userQueryDisplay || userQueryInternal,
            outcome: plan.outcome,
            results: summaries,
          };

          const textResult = streamText({
            model: gateway(EXPLAINER_MODEL),
            system: EXPLAINER_PROMPT,
            prompt: JSON.stringify(explainerInput),
            temperature: 0.3,
          });

          for await (const delta of textResult.textStream) {
            if (closed) break;
            explanation += delta;
            emit("text_delta", { delta });
          }
        }

        if (closed) return;

        // ── PERSIST (only on successful completion) ──────────────
        const response = {
          success: true,
          sessionId,
          outcome: plan.outcome,
          results: results.map(({ step, data, meta }) => ({ step, data, meta })),
          explanation,
          rawPrompt: userQueryDisplay,
          rawPromptInternal: userQueryInternal,
          toolRequest: plan,
          usage: planUsage,
        };

        const title = (userQueryDisplay || userQueryInternal).slice(0, 80);

        // One transaction so a session row can never end up with a message
        // count that disagrees with the messages actually stored.
        await prisma.$transaction(async (tx) => {
          const session = await tx.aiReportSession.upsert({
            where: { userId_sessionId: { userId: currentUser.id, sessionId } },
            update: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
            create: {
              userId: currentUser.id,
              sessionId,
              title,
              lastMessageAt: new Date(),
              messageCount: 1,
            },
          });

          await tx.aiReportSessionMessage.create({
            data: {
              sessionRowId: session.id,
              userId: currentUser.id,
              queryText: userQueryDisplay || userQueryInternal,
              queryTextDisplay: userQueryDisplay,
              queryTextInternal: userQueryInternal,
              toolRequest: serializeForStorage(plan),
              response: serializeForStorage(response),
            },
          });
        });

        emit("done", { sessionId, usage: planUsage });
      } catch (err: unknown) {
        console.error("[AI Run Error]", err);
        emit("error", {
          message: err instanceof Error ? err.message : "Run execution failed",
        });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 60;
