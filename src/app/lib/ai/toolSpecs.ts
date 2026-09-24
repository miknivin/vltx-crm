/**
 * Single source of truth for the AI report pipeline's tool surface.
 *
 * Both the planner prompt (via buildMethodDocs) and the server-side validator
 * (validatePipeline) are generated from the same specs, so what the model is
 * told and what the server enforces cannot drift. The specs mirror the real
 * builder signatures in `src/app/classes/EnquiryFilterBuilder.ts` and
 * `src/app/classes/EnquiryAggregationBuilder.ts`.
 */

import {
  ASSET_CATEGORY_LABELS,
  CERTIFICATE_LAB_LABELS,
  CONDITION_LABELS,
} from "@/app/lib/enquiry/constants";
import { FILTERABLE_ENQUIRY_FIELDS } from "@/app/classes/EnquiryFilterBuilder";

// ── Field allowlist ──────────────────────────────────────────────────
// Derived from the filter builder rather than restated, so a field can only
// become AI-reachable by being added to the builder's own map.
export const FILTERABLE_FIELDS = FILTERABLE_ENQUIRY_FIELDS;

/// Columns the model may ask to display. Includes the label variants the
/// serializer adds, which are what a person actually wants to read.
export const DISPLAYABLE_FIELDS = [
  "reference",
  "name",
  "phone",
  "email",
  "city",
  "preferredContactLabel",
  "categoryLabel",
  "jewelleryTypeLabel",
  "brand",
  "metalWeightG",
  "caratWeight",
  "shapeCutLabel",
  "conditionLabel",
  "certificateAvailable",
  "certificateLabLabel",
  "purchaseYear",
  "description",
  "estimatedValue",
  "offeredAmount",
  "valuedAt",
  "probability",
  "notes",
  "source",
  "tags",
  "assignedTo",
  "createdAt",
  "updatedAt",
] as const;

type ArgType =
  | "field"
  | "primitive"
  | "string"
  | "number"
  | "boolean"
  | "objectId"
  | "primitiveArray"
  | "stringOrArray"
  | "date"
  | "unit";

interface ArgSpec {
  name: string;
  type: ArgType;
  optional?: boolean;
}

export interface MethodSpec {
  args: ArgSpec[];
  /**
   * Display columns this method implicates. "fieldArg" means "whatever field
   * the first arg names"; a string[] is a fixed set.
   */
  touches: "fieldArg" | string[];
  doc: string;
}

const TIME_UNITS = ["day", "week", "month", "year"];
/// Ids are UUIDs now, not 24-character Mongo ObjectIds.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/// Filter fields map to display columns under different names — the filter
/// reaches through a relation, the column is flat.
const FIELD_TO_COLUMN: Record<string, string> = {
  "customer.name": "name",
  "customer.mobile": "phone",
  "customer.email": "email",
  "customer.city": "city",
  "customer.preferredContact": "preferredContactLabel",
  category: "categoryLabel",
  jewelleryType: "jewelleryTypeLabel",
  shapeCut: "shapeCutLabel",
  condition: "conditionLabel",
  certificateLab: "certificateLabLabel",
  "tags.name": "tags",
  "assignedTo.user": "assignedTo",
  "pipelinesActive.pipeline_id": "reference",
  "pipelinesActive.stage_id": "reference",
};

const columnFor = (field: string) => FIELD_TO_COLUMN[field] ?? field;

// ── Filter methods (EnquiryFilterBuilder, used by findEnquiries) ─────
export const FILTER_METHOD_SPECS: Record<string, MethodSpec> = {
  eq: { args: [{ name: "field", type: "field" }, { name: "value", type: "primitive" }], touches: "fieldArg", doc: "field equals value" },
  ne: { args: [{ name: "field", type: "field" }, { name: "value", type: "primitive" }], touches: "fieldArg", doc: "field not equal to value" },
  gt: { args: [{ name: "field", type: "field" }, { name: "value", type: "primitive" }], touches: "fieldArg", doc: "field greater than value" },
  gte: { args: [{ name: "field", type: "field" }, { name: "value", type: "primitive" }], touches: "fieldArg", doc: "field greater than or equal" },
  lt: { args: [{ name: "field", type: "field" }, { name: "value", type: "primitive" }], touches: "fieldArg", doc: "field less than value" },
  lte: { args: [{ name: "field", type: "field" }, { name: "value", type: "primitive" }], touches: "fieldArg", doc: "field less than or equal" },
  in: { args: [{ name: "field", type: "field" }, { name: "values", type: "primitiveArray" }], touches: "fieldArg", doc: "field is one of values" },
  nin: { args: [{ name: "field", type: "field" }, { name: "values", type: "primitiveArray" }], touches: "fieldArg", doc: "field is none of values" },
  contains: { args: [{ name: "field", type: "field" }, { name: "text", type: "string" }], touches: "fieldArg", doc: "field contains text (case-insensitive)" },
  exists: { args: [{ name: "field", type: "field" }, { name: "value", type: "boolean", optional: true }], touches: "fieldArg", doc: "field has a value (or is empty, if value=false)" },
  assignedTo: { args: [{ name: "userId", type: "objectId" }], touches: ["assignedTo"], doc: "enquiry is assigned to this user (UUID)" },
  notAssignedTo: { args: [{ name: "userId", type: "objectId" }], touches: ["assignedTo"], doc: "enquiry is NOT assigned to this user" },
  assignedOnlyTo: { args: [{ name: "userId", type: "objectId" }], touches: ["assignedTo"], doc: "enquiry is assigned to ONLY this user" },
  unassigned: { args: [], touches: ["assignedTo"], doc: "nobody owns this enquiry yet" },
  hasAnyAssignee: { args: [], touches: ["assignedTo"], doc: "enquiry has at least one owner" },
  isConverted: { args: [], touches: ["reference"], doc: "the asset was bought — enquiry sits in a success stage" },
  notConverted: { args: [], touches: ["reference"], doc: "enquiry is on a pipeline but not in a success stage" },
  valued: { args: [], touches: ["estimatedValue"], doc: "the team has recorded an estimated value" },
  notValued: { args: [], touches: ["estimatedValue"], doc: "still awaiting valuation (no estimate recorded)" },
};

// ── Aggregate methods (EnquiryAggregationBuilder) ────────────────────
export const AGGREGATE_METHOD_SPECS: Record<string, MethodSpec> = {
  filterByPipeline: { args: [{ name: "pipelineId", type: "objectId" }], touches: [], doc: "only enquiries on this pipeline" },
  filterByStage: { args: [{ name: "stageId", type: "objectId" }], touches: [], doc: "only enquiries currently in this stage" },
  filterByTag: { args: [{ name: "tagNames", type: "stringOrArray" }], touches: [], doc: "only enquiries having any of these tag names" },
  filterByAssignedUser: { args: [{ name: "userId", type: "objectId" }], touches: [], doc: "only enquiries assigned to this user (UUID)" },
  filterBySource: { args: [{ name: "source", type: "stringOrArray" }], touches: [], doc: "only enquiries from these source(s)" },
  filterByCategory: { args: [{ name: "category", type: "stringOrArray" }], touches: [], doc: `only these asset categories (${Object.values(ASSET_CATEGORY_LABELS).join(", ")})` },
  filterByCondition: { args: [{ name: "condition", type: "stringOrArray" }], touches: [], doc: `only these conditions (${Object.values(CONDITION_LABELS).join(", ")})` },
  filterByCertificateLab: { args: [{ name: "lab", type: "stringOrArray" }], touches: [], doc: `only these certifying labs (${Object.values(CERTIFICATE_LAB_LABELS).join(", ")})` },
  filterByCreatedAt: { args: [{ name: "from", type: "date", optional: true }, { name: "to", type: "date", optional: true }], touches: [], doc: "submitted within date range (ISO strings)" },
  filterConverted: { args: [], touches: [], doc: "only enquiries whose asset was bought" },
  filterValued: { args: [], touches: [], doc: "only enquiries with an estimated value recorded" },
  groupByPipeline: { args: [], touches: [], doc: "group and count by pipeline" },
  groupByStage: { args: [], touches: [], doc: "group and count by stage" },
  groupByTag: { args: [], touches: [], doc: "group and count by tag name" },
  groupByAssignedUser: { args: [], touches: [], doc: "group and count by assigned user" },
  groupBySource: { args: [], touches: [], doc: "group and count by source" },
  groupByCategory: { args: [], touches: [], doc: "group and count by asset category" },
  groupByCondition: { args: [], touches: [], doc: "group and count by condition" },
  groupByCertificateLab: { args: [], touches: [], doc: "group and count by certifying lab" },
  groupByCity: { args: [], touches: [], doc: "group and count by the seller's city" },
  groupByTime: { args: [{ name: "unit", type: "unit" }, { name: "field", type: "field", optional: true }], touches: [], doc: "group and count by time bucket (unit: day|week|month|year; field defaults to createdAt)" },
  count: { args: [], touches: [], doc: "count matching enquiries (returns {total})" },
  sum: { args: [{ name: "field", type: "field" }, { name: "as", type: "string", optional: true }], touches: [], doc: "sum a numeric field (estimatedValue, offeredAmount, caratWeight, metalWeightG)" },
  avg: { args: [{ name: "field", type: "field" }, { name: "as", type: "string", optional: true }], touches: [], doc: "average a numeric field" },
};

// ── Validation ───────────────────────────────────────────────────────

interface ActionLike {
  method: string;
  args?: unknown[];
}

interface StepLike {
  toolName?: string;
  tool?: string;
  filterActions?: ActionLike[];
  aggregateActions?: ActionLike[];
  columns?: string[] | null;
  args?: {
    filterActions?: ActionLike[];
    aggregateActions?: ActionLike[];
    columns?: string[] | null;
  };
}

const isPrimitive = (v: unknown) =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean";

function validateArg(value: unknown, spec: ArgSpec, where: string): string | null {
  switch (spec.type) {
    case "field":
      if (typeof value !== "string" || !FILTERABLE_FIELDS.includes(value)) {
        return `${where}: "${String(value)}" is not a filterable field. Allowed: ${FILTERABLE_FIELDS.join(", ")}`;
      }
      return null;
    case "objectId":
      if (typeof value !== "string" || !UUID_RE.test(value)) {
        return `${where}: expected a UUID, got "${String(value)}"`;
      }
      return null;
    case "string":
      return typeof value === "string" ? null : `${where}: expected a string`;
    case "number":
      return typeof value === "number" ? null : `${where}: expected a number`;
    case "boolean":
      return typeof value === "boolean" ? null : `${where}: expected a boolean`;
    case "primitive":
      return isPrimitive(value) ? null : `${where}: expected a string/number/boolean`;
    case "primitiveArray":
      return Array.isArray(value) && value.every(isPrimitive)
        ? null
        : `${where}: expected an array of primitives`;
    case "stringOrArray":
      if (typeof value === "string") return null;
      return Array.isArray(value) && value.every((v) => typeof v === "string")
        ? null
        : `${where}: expected a string or array of strings`;
    case "date":
      return typeof value === "string" && !Number.isNaN(new Date(value).getTime())
        ? null
        : `${where}: expected an ISO date string`;
    case "unit":
      return typeof value === "string" && TIME_UNITS.includes(value)
        ? null
        : `${where}: expected one of ${TIME_UNITS.join("|")}`;
  }
}

function validateActions(
  actions: ActionLike[],
  specs: Record<string, MethodSpec>,
  bucket: string,
  stepLabel: string
): string[] {
  const issues: string[] = [];

  for (const action of actions) {
    const spec = specs[action.method];
    const where = `${stepLabel} ${bucket}.${action.method}`;

    if (!spec) {
      issues.push(`${where}: unknown method. Allowed: ${Object.keys(specs).join(", ")}`);
      continue;
    }

    const args = action.args ?? [];
    const required = spec.args.filter((a) => !a.optional).length;

    if (args.length < required || args.length > spec.args.length) {
      const signature = spec.args.map((a) => a.name + (a.optional ? "?" : "")).join(", ");
      issues.push(`${where}: expects (${signature}) but got ${args.length} arg(s)`);
      continue;
    }

    args.forEach((value, index) => {
      const argSpec = spec.args[index];
      if (!argSpec) return;
      const issue = validateArg(value, argSpec, `${where} arg "${argSpec.name}"`);
      if (issue) issues.push(issue);
    });
  }

  return issues;
}

/**
 * Semantic validation of a planned pipeline, beyond what the Zod shape check
 * can express. Returns issue strings (empty = valid) precise enough to feed
 * back to the model for a repair retry.
 */
export function validatePipeline(plan: { steps: StepLike[] }): string[] {
  const issues: string[] = [];

  plan.steps.forEach((step, index) => {
    const label = `step ${index + 1}`;
    const tool = step.tool ?? step.toolName;
    const args = step.args ?? step;
    const filterActions = args.filterActions ?? [];
    const aggregateActions = args.aggregateActions ?? [];

    if (tool === "findEnquiries") {
      if (aggregateActions.length > 0) {
        issues.push(`${label}: findEnquiries must use filterActions, not aggregateActions`);
      }
      issues.push(...validateActions(filterActions, FILTER_METHOD_SPECS, "filterActions", label));
    } else if (tool === "aggregateEnquiries") {
      if (filterActions.length > 0) {
        issues.push(`${label}: aggregateEnquiries must use aggregateActions, not filterActions`);
      }
      if (aggregateActions.length === 0) {
        issues.push(`${label}: aggregateEnquiries requires at least one aggregateAction`);
      }
      issues.push(...validateActions(aggregateActions, AGGREGATE_METHOD_SPECS, "aggregateActions", label));
    } else {
      issues.push(`${label}: unknown tool "${String(tool)}"`);
    }

    for (const column of args.columns ?? []) {
      if (!(DISPLAYABLE_FIELDS as readonly string[]).includes(column)) {
        issues.push(
          `${label}: column "${column}" is not displayable. Allowed: ${DISPLAYABLE_FIELDS.join(", ")}`
        );
      }
    }
  });

  return issues;
}

// ── The "main rule": shown columns must cover what was filtered ──────

const actionTouchedColumns = (
  actions: ActionLike[],
  specs: Record<string, MethodSpec>
): string[] => {
  const columns: string[] = [];
  for (const action of actions) {
    const spec = specs[action.method];
    if (!spec) continue;
    if (spec.touches === "fieldArg") {
      const field = action.args?.[0];
      if (typeof field === "string") columns.push(columnFor(field));
    } else {
      columns.push(...spec.touches);
    }
  }
  return columns;
};

/**
 * Every field a filter touched must appear in the displayed columns, so a
 * person can check the answer against the question they asked — filter by
 * category, and the category column is there to confirm it.
 *
 * Unlike the Mongo version this shapes display only; the query always returns
 * the full serialized enquiry, so narrowing columns can never hide a field the
 * explainer still needs.
 */
export function ensureColumnsCoverFilters(step: {
  toolName: string;
  filterActions: ActionLike[];
  aggregateActions: ActionLike[];
  columns: string[] | null;
}): void {
  // Grouped output reshapes rows entirely, so the rule applies to
  // record-shaped results only.
  if (step.toolName !== "findEnquiries") return;

  const touched = actionTouchedColumns(step.filterActions, FILTER_METHOD_SPECS);
  const columns = step.columns?.length ? [...step.columns] : [...DEFAULT_COLUMNS];

  for (const column of touched) {
    if (!columns.includes(column)) columns.push(column);
  }

  step.columns = columns;
}

/// What a result table shows when the model does not ask for anything
/// specific: who, what asset, and where it stands.
export const DEFAULT_COLUMNS = [
  "reference",
  "name",
  "phone",
  "categoryLabel",
  "estimatedValue",
  "createdAt",
] as const;

// ── Prompt generation ────────────────────────────────────────────────

const renderSpecDocs = (specs: Record<string, MethodSpec>): string =>
  Object.entries(specs)
    .map(([name, spec]) => {
      const signature = spec.args.map((a) => a.name + (a.optional ? "?" : "")).join(", ");
      return `- ${name}(${signature}) — ${spec.doc}`;
    })
    .join("\n");

export function buildMethodDocs(): string {
  return [
    "findEnquiries filterActions (list/search record queries):",
    renderSpecDocs(FILTER_METHOD_SPECS),
    "",
    "aggregateEnquiries aggregateActions (counts/grouping/analytics):",
    renderSpecDocs(AGGREGATE_METHOD_SPECS),
    "",
    `Filterable fields: ${FILTERABLE_FIELDS.join(", ")}`,
    `Displayable columns: ${DISPLAYABLE_FIELDS.join(", ")}`,
    "",
    "Enum values, given as the labels a person would type:",
    `- category: ${Object.values(ASSET_CATEGORY_LABELS).join(", ")}`,
    `- condition: ${Object.values(CONDITION_LABELS).join(", ")}`,
    `- certificateLab: ${Object.values(CERTIFICATE_LAB_LABELS).join(", ")}`,
  ].join("\n");
}
