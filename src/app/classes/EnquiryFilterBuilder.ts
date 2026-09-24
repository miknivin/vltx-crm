import type { Prisma } from "@prisma/client";

type Where = Prisma.EnquiryWhereInput;
type Scalar = string | number | boolean | Date | null;

/// How a filterable field maps onto `Prisma.EnquiryWhereInput`. Scalar fields
/// sit on the enquiry itself; the rest reach through a relation, so each one
/// declares how to wrap a leaf condition.
type FieldKind = "string" | "number" | "boolean" | "date" | "enum";

interface FieldSpec {
  kind: FieldKind;
  /// Builds the `where` fragment for a condition on this field.
  wrap: (condition: Prisma.StringFilter | Prisma.IntFilter | object) => Where;
}

function own(column: string, kind: FieldKind): [string, FieldSpec] {
  return [column, { kind, wrap: (condition) => ({ [column]: condition }) as Where }];
}

function viaCustomer(column: string, kind: FieldKind): [string, FieldSpec] {
  return [
    `customer.${column}`,
    { kind, wrap: (condition) => ({ customer: { [column]: condition } }) as Where },
  ];
}

/// Every field the filter panel and the AI planner are allowed to touch.
/// Anything not listed here is rejected before a query is built, so a
/// mis-planned field name can never reach the database.
export const ENQUIRY_FIELD_SPECS: Record<string, FieldSpec> = Object.fromEntries([
  own("reference", "number"),
  own("category", "enum"),
  own("jewelleryType", "enum"),
  own("brand", "string"),
  own("metalWeightG", "number"),
  own("caratWeight", "number"),
  own("shapeCut", "enum"),
  own("condition", "enum"),
  own("certificateAvailable", "boolean"),
  own("certificateLab", "enum"),
  own("purchaseYear", "number"),
  own("description", "string"),
  own("estimatedValue", "number"),
  own("offeredAmount", "number"),
  own("probability", "number"),
  own("notes", "string"),
  own("createdAt", "date"),
  own("updatedAt", "date"),
  own("valuedAt", "date"),
  viaCustomer("name", "string"),
  viaCustomer("mobile", "string"),
  viaCustomer("email", "string"),
  viaCustomer("city", "string"),
  viaCustomer("preferredContact", "enum"),
  [
    "source",
    {
      kind: "string",
      wrap: (condition) => ({ source: { title: condition } }) as Where,
    },
  ],
  [
    "tags.name",
    {
      kind: "string",
      wrap: (condition) => ({ tags: { some: { name: condition } } }) as Where,
    },
  ],
  [
    "assignedTo.user",
    {
      kind: "string",
      wrap: (condition) => ({ assignedTo: { some: { userId: condition } } }) as Where,
    },
  ],
  [
    "pipelinesActive.pipeline_id",
    {
      kind: "string",
      wrap: (condition) =>
        ({ pipelineEntries: { some: { pipelineId: condition } } }) as Where,
    },
  ],
  [
    "pipelinesActive.stage_id",
    {
      kind: "string",
      wrap: (condition) => ({ pipelineEntries: { some: { stageId: condition } } }) as Where,
    },
  ],
]);

export const FILTERABLE_ENQUIRY_FIELDS = Object.keys(ENQUIRY_FIELD_SPECS);

export class UnknownFieldError extends Error {
  constructor(field: string) {
    super(
      `Unknown filter field "${field}". Allowed: ${FILTERABLE_ENQUIRY_FIELDS.join(", ")}`
    );
    this.name = "UnknownFieldError";
  }
}

function specFor(field: string): FieldSpec {
  const spec = ENQUIRY_FIELD_SPECS[field];
  if (!spec) throw new UnknownFieldError(field);
  return spec;
}

/// Coerces an incoming JSON value to what the column expects. A date column
/// given the string "2026-01-01" would otherwise be compared as text and
/// silently match nothing.
function coerce(spec: FieldSpec, value: Scalar): unknown {
  if (value === null) return null;
  switch (spec.kind) {
    case "number":
      return typeof value === "number" ? value : Number(value);
    case "boolean":
      return typeof value === "boolean" ? value : String(value).toLowerCase() === "true";
    case "date":
      return value instanceof Date ? value : new Date(String(value));
    default:
      return value;
  }
}

/// Builds a `Prisma.EnquiryWhereInput` from discrete filter calls. Replaces
/// MongoFilterBuilder: conditions accumulate into an `AND` list rather than
/// being merged into one object, so two conditions on the same field (a range,
/// say) no longer overwrite each other.
export class EnquiryFilterBuilder {
  private conditions: Where[] = [];
  private successStageIds: string[] = [];

  static create(): EnquiryFilterBuilder {
    return new EnquiryFilterBuilder();
  }

  /// Stage ids that count as converted, fetched from `Stage.isSuccess` by the
  /// caller before any of the conversion helpers run.
  setSuccessStageIds(ids: string[]): this {
    this.successStageIds = ids;
    return this;
  }

  private push(field: string, condition: object): this {
    this.conditions.push(specFor(field).wrap(condition));
    return this;
  }

  private comparison(field: string, operator: string, value: Scalar): this {
    const spec = specFor(field);
    return this.push(field, { [operator]: coerce(spec, value) });
  }

  eq(field: string, value: Scalar): this {
    const spec = specFor(field);
    return this.push(field, { equals: coerce(spec, value) });
  }

  ne(field: string, value: Scalar): this {
    const spec = specFor(field);
    return this.push(field, { not: coerce(spec, value) });
  }

  gt(field: string, value: Scalar): this {
    return this.comparison(field, "gt", value);
  }

  gte(field: string, value: Scalar): this {
    return this.comparison(field, "gte", value);
  }

  lt(field: string, value: Scalar): this {
    return this.comparison(field, "lt", value);
  }

  lte(field: string, value: Scalar): this {
    return this.comparison(field, "lte", value);
  }

  in(field: string, values: Scalar[]): this {
    const spec = specFor(field);
    return this.push(field, { in: values.map((value) => coerce(spec, value)) });
  }

  nin(field: string, values: Scalar[]): this {
    const spec = specFor(field);
    return this.push(field, { notIn: values.map((value) => coerce(spec, value)) });
  }

  /// Case-insensitive substring match. The `pg_trgm` GIN indexes added in the
  /// initial migration are what keep this from a sequential scan.
  contains(field: string, text: string): this {
    return this.push(field, { contains: text, mode: "insensitive" });
  }

  /// `true` means "has a value", mirroring Mongo's `$exists`.
  exists(field: string, value = true): this {
    return this.push(field, value ? { not: null } : { equals: null });
  }

  // ── assignment ───────────────────────────────────────────────────────────

  assignedTo(userId: string): this {
    if (!userId) return this;
    this.conditions.push({ assignedTo: { some: { userId } } });
    return this;
  }

  notAssignedTo(userId: string): this {
    if (!userId) return this;
    this.conditions.push({ assignedTo: { none: { userId } } });
    return this;
  }

  /// Assigned to this person and nobody else.
  assignedOnlyTo(userId: string): this {
    this.conditions.push({
      assignedTo: { some: { userId }, every: { userId } },
    });
    return this;
  }

  unassigned(): this {
    this.conditions.push({ assignedTo: { none: {} } });
    return this;
  }

  hasAnyAssignee(): this {
    this.conditions.push({ assignedTo: { some: {} } });
    return this;
  }

  /// Restricts to a pre-resolved set of ids. A Prisma `where` has no count
  /// predicate, so "more than one assignee" is resolved to ids first — see
  /// `findMultiAssigneeEnquiryIds` — and narrowed here.
  idIn(ids: string[]): this {
    this.conditions.push({ id: { in: ids } });
    return this;
  }

  idNotIn(ids: string[]): this {
    this.conditions.push({ id: { notIn: ids } });
    return this;
  }

  // ── conversion ───────────────────────────────────────────────────────────

  /// Sits in a stage marked `isSuccess` — the enquiry was bought.
  isConverted(): this {
    this.conditions.push({
      pipelineEntries: { some: { stageId: { in: this.successStageIds } } },
    });
    return this;
  }

  hasSuccessStage(): this {
    return this.isConverted();
  }

  /// In a pipeline, but not in a success stage. An enquiry on no pipeline at
  /// all is excluded, matching how the board treats it as not yet in play.
  notConverted(): this {
    this.conditions.push({
      pipelineEntries: {
        some: {},
        none: { stageId: { in: this.successStageIds } },
      },
    });
    return this;
  }

  // ── valuation ────────────────────────────────────────────────────────────

  /// A team member has recorded an estimate for this asset.
  valued(): this {
    this.conditions.push({ estimatedValue: { not: null } });
    return this;
  }

  notValued(): this {
    this.conditions.push({ estimatedValue: null });
    return this;
  }

  // ── grouping ─────────────────────────────────────────────────────────────

  or(build: (builder: EnquiryFilterBuilder) => void): this {
    const nested = EnquiryFilterBuilder.create().setSuccessStageIds(this.successStageIds);
    build(nested);
    const branches = nested.conditions;
    if (branches.length) this.conditions.push({ OR: branches });
    return this;
  }

  and(build: (builder: EnquiryFilterBuilder) => void): this {
    const nested = EnquiryFilterBuilder.create().setSuccessStageIds(this.successStageIds);
    build(nested);
    this.conditions.push(...nested.conditions);
    return this;
  }

  /// Escape hatch for conditions the field map cannot express, such as the
  /// team-member scoping the filter route applies before anything else.
  raw(condition: Where): this {
    this.conditions.push(condition);
    return this;
  }

  build(): Where {
    if (this.conditions.length === 0) return {};
    if (this.conditions.length === 1) return this.conditions[0];
    return { AND: this.conditions };
  }
}

export default EnquiryFilterBuilder;
