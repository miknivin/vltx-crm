import EnquiryAggregationBuilder from "@/app/classes/EnquiryAggregationBuilder";

interface AggregateStep {
  aggregateActions?: { method: string; args?: unknown[] }[];
  sort?: Record<string, number> | null;
  limit?: number | null;
}

/// Methods that need to await something before the query runs.
const ASYNC_METHODS = new Set(["filterConverted"]);

/**
 * Runs a single planned "aggregate" step.
 *
 * `scopeUserId` is applied first, so a team member's analytics can only ever
 * cover their own enquiries regardless of what the planner asked for.
 */
export async function executeAggregateQuery(
  step: AggregateStep,
  scopeUserId: string | null
) {
  const builder = EnquiryAggregationBuilder.create();

  if (scopeUserId) builder.scopeToUser(scopeUserId);

  for (const action of step.aggregateActions ?? []) {
    const { method, args } = action;
    const fn = (builder as unknown as Record<string, unknown>)[method];

    if (typeof fn !== "function") {
      throw new Error(`Unknown aggregate method: ${method}`);
    }

    if (ASYNC_METHODS.has(method)) {
      await (fn as (...rest: unknown[]) => Promise<unknown>).call(builder, ...(args ?? []));
    } else {
      (fn as (...rest: unknown[]) => unknown).call(builder, ...(args ?? []));
    }
  }

  if (step.sort) builder.sort(step.sort);
  if (step.limit) builder.limit(step.limit);

  return builder.exec();
}
