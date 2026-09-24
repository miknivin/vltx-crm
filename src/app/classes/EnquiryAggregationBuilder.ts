import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { getSuccessStageIds } from "@/app/lib/utils/successStages";
import {
  parseAssetCategory,
  parseCertificateLab,
  parseCondition,
} from "@/app/lib/enquiry/constants";

type Where = Prisma.EnquiryWhereInput;
type TimeUnit = "day" | "week" | "month" | "year";

export interface AggregateRow {
  /// What the bucket is — a stage name, a category, a month. Absent for
  /// whole-result metrics like `count`.
  label?: string;
  id?: string | null;
  count?: number;
  total?: number;
  [metric: string]: string | number | null | undefined;
}

/// Numeric columns a `sum`/`avg` may target. Anything else is refused rather
/// than silently producing a zero.
const NUMERIC_FIELDS: Record<string, "estimatedValue" | "offeredAmount" | "caratWeight" | "metalWeightG" | "probability" | "purchaseYear"> = {
  estimatedValue: "estimatedValue",
  offeredAmount: "offeredAmount",
  caratWeight: "caratWeight",
  metalWeightG: "metalWeightG",
  probability: "probability",
  purchaseYear: "purchaseYear",
};

/// Cap on rows pulled into memory for the two groupings Prisma cannot express
/// as a database-side `groupBy` (bucketing by month, and grouping by a column
/// on the related customer). At this business's volume the whole table is well
/// under the cap; the limit exists so a runaway query degrades visibly rather
/// than exhausting memory.
const IN_MEMORY_GROUP_LIMIT = 20000;

const asArray = (value: string | string[]): string[] =>
  Array.isArray(value) ? value : [value];

/**
 * Builds and runs the analytics queries the AI planner asks for.
 *
 * Replaces ContactAggregationBuilder: instead of assembling a Mongo pipeline
 * array, each method narrows a `where` or picks the grouping, and `exec()`
 * dispatches to the matching Prisma query.
 */
export class EnquiryAggregationBuilder {
  private conditions: Where[] = [];
  private grouping:
    | { kind: "none" }
    | { kind: "scalar"; column: "category" | "condition" | "certificateLab" | "sourceId" }
    | { kind: "pipelineEntry"; column: "pipelineId" | "stageId" }
    | { kind: "tag" }
    | { kind: "assignedUser" }
    | { kind: "city" }
    | { kind: "time"; unit: TimeUnit; field: "createdAt" | "updatedAt" | "valuedAt" } = {
    kind: "none",
  };
  private metrics: { op: "count" } | { op: "sum" | "avg"; field: string; as: string } = {
    op: "count",
  };
  private sortSpec: Record<string, number> | null = null;
  private limitSpec: number | null = null;

  static create(): EnquiryAggregationBuilder {
    return new EnquiryAggregationBuilder();
  }

  /// Applied before anything the model asked for, so no planned action can
  /// widen a team member's view past their own enquiries.
  scopeToUser(userId: string): this {
    this.conditions.push({ assignedTo: { some: { userId } } });
    return this;
  }

  // ── filters ──────────────────────────────────────────────────────────────

  filterByPipeline(pipelineId: string): this {
    this.conditions.push({ pipelineEntries: { some: { pipelineId } } });
    return this;
  }

  filterByStage(stageId: string): this {
    this.conditions.push({ pipelineEntries: { some: { stageId } } });
    return this;
  }

  filterByTag(tagNames: string | string[]): this {
    this.conditions.push({ tags: { some: { name: { in: asArray(tagNames) } } } });
    return this;
  }

  filterByAssignedUser(userId: string): this {
    this.conditions.push({ assignedTo: { some: { userId } } });
    return this;
  }

  filterBySource(source: string | string[]): this {
    this.conditions.push({ source: { title: { in: asArray(source) } } });
    return this;
  }

  filterByCategory(category: string | string[]): this {
    const parsed = asArray(category)
      .map(parseAssetCategory)
      .filter((value): value is NonNullable<typeof value> => value !== null);
    if (parsed.length) this.conditions.push({ category: { in: parsed } });
    return this;
  }

  filterByCondition(condition: string | string[]): this {
    const parsed = asArray(condition)
      .map(parseCondition)
      .filter((value): value is NonNullable<typeof value> => value !== null);
    if (parsed.length) this.conditions.push({ condition: { in: parsed } });
    return this;
  }

  filterByCertificateLab(lab: string | string[]): this {
    const parsed = asArray(lab)
      .map(parseCertificateLab)
      .filter((value): value is NonNullable<typeof value> => value !== null);
    if (parsed.length) this.conditions.push({ certificateLab: { in: parsed } });
    return this;
  }

  filterByCreatedAt(from?: string, to?: string): this {
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    if (Object.keys(range).length) this.conditions.push({ createdAt: range });
    return this;
  }

  async filterConverted(): Promise<this> {
    const successStageIds = await getSuccessStageIds();
    this.conditions.push(
      successStageIds.length
        ? { pipelineEntries: { some: { stageId: { in: successStageIds } } } }
        : // No success stage configured means nothing qualifies, rather than
          // an empty `in` that would match everything.
          { id: { in: [] } }
    );
    return this;
  }

  filterValued(): this {
    this.conditions.push({ estimatedValue: { not: null } });
    return this;
  }

  // ── grouping ─────────────────────────────────────────────────────────────

  groupByCategory(): this {
    this.grouping = { kind: "scalar", column: "category" };
    return this;
  }

  groupByCondition(): this {
    this.grouping = { kind: "scalar", column: "condition" };
    return this;
  }

  groupByCertificateLab(): this {
    this.grouping = { kind: "scalar", column: "certificateLab" };
    return this;
  }

  groupBySource(): this {
    this.grouping = { kind: "scalar", column: "sourceId" };
    return this;
  }

  groupByPipeline(): this {
    this.grouping = { kind: "pipelineEntry", column: "pipelineId" };
    return this;
  }

  groupByStage(): this {
    this.grouping = { kind: "pipelineEntry", column: "stageId" };
    return this;
  }

  groupByTag(): this {
    this.grouping = { kind: "tag" };
    return this;
  }

  groupByAssignedUser(): this {
    this.grouping = { kind: "assignedUser" };
    return this;
  }

  groupByCity(): this {
    this.grouping = { kind: "city" };
    return this;
  }

  groupByTime(unit: TimeUnit, field?: string): this {
    const dateField =
      field === "updatedAt" || field === "valuedAt" ? field : "createdAt";
    this.grouping = { kind: "time", unit, field: dateField };
    return this;
  }

  // ── metrics ──────────────────────────────────────────────────────────────

  count(): this {
    this.metrics = { op: "count" };
    return this;
  }

  sum(field: string, as?: string): this {
    this.metrics = { op: "sum", field, as: as || `sum_${field}` };
    return this;
  }

  avg(field: string, as?: string): this {
    this.metrics = { op: "avg", field, as: as || `avg_${field}` };
    return this;
  }

  sort(spec: Record<string, number>): this {
    this.sortSpec = spec;
    return this;
  }

  limit(value: number): this {
    this.limitSpec = value;
    return this;
  }

  private get where(): Where {
    if (this.conditions.length === 0) return {};
    if (this.conditions.length === 1) return this.conditions[0];
    return { AND: this.conditions };
  }

  // ── execution ────────────────────────────────────────────────────────────

  async exec(): Promise<AggregateRow[]> {
    const rows = await this.run();
    const sorted = this.applySort(rows);
    return this.limitSpec ? sorted.slice(0, this.limitSpec) : sorted;
  }

  private applySort(rows: AggregateRow[]): AggregateRow[] {
    if (!this.sortSpec) {
      // Biggest bucket first is what a person reading a breakdown expects.
      return [...rows].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    }
    const [key, direction] = Object.entries(this.sortSpec)[0] ?? ["count", -1];
    return [...rows].sort((a, b) => {
      const left = a[key];
      const right = b[key];
      if (typeof left === "number" && typeof right === "number") {
        return direction >= 0 ? left - right : right - left;
      }
      return direction >= 0
        ? String(left ?? "").localeCompare(String(right ?? ""))
        : String(right ?? "").localeCompare(String(left ?? ""));
    });
  }

  private numericField(): keyof typeof NUMERIC_FIELDS {
    if (this.metrics.op === "count") throw new Error("No numeric field for a count");
    const field = NUMERIC_FIELDS[this.metrics.field];
    if (!field) {
      throw new Error(
        `"${this.metrics.field}" is not a numeric field. Allowed: ${Object.keys(NUMERIC_FIELDS).join(", ")}`
      );
    }
    return field;
  }

  private async run(): Promise<AggregateRow[]> {
    const where = this.where;

    if (this.grouping.kind === "none") {
      if (this.metrics.op === "count") {
        return [{ total: await prisma.enquiry.count({ where }) }];
      }

      const field = this.numericField();
      const result = await prisma.enquiry.aggregate({
        where,
        ...(this.metrics.op === "sum"
          ? { _sum: { [field]: true } }
          : { _avg: { [field]: true } }),
      } as Prisma.EnquiryAggregateArgs);

      const raw =
        this.metrics.op === "sum"
          ? (result._sum as Record<string, unknown>)?.[field]
          : (result._avg as Record<string, unknown>)?.[field];

      return [{ [this.metrics.as]: raw === null || raw === undefined ? 0 : Number(raw) }];
    }

    switch (this.grouping.kind) {
      case "scalar":
        return this.groupScalar(where, this.grouping.column);
      case "pipelineEntry":
        return this.groupPipelineEntry(where, this.grouping.column);
      case "tag":
        return this.groupTag(where);
      case "assignedUser":
        return this.groupAssignedUser(where);
      case "city":
        return this.groupCity(where);
      case "time":
        return this.groupTime(where, this.grouping.unit, this.grouping.field);
    }
  }

  private async groupScalar(
    where: Where,
    column: "category" | "condition" | "certificateLab" | "sourceId"
  ): Promise<AggregateRow[]> {
    const grouped = await prisma.enquiry.groupBy({
      by: [column],
      where,
      _count: { _all: true },
    } as Prisma.EnquiryGroupByArgs as never);

    const rows = grouped as unknown as Array<Record<string, unknown> & { _count: { _all: number } }>;

    if (column !== "sourceId") {
      return rows.map((row) => ({
        id: (row[column] as string | null) ?? null,
        label: (row[column] as string | null) ?? "Not set",
        count: row._count._all,
      }));
    }

    const sourceIds = rows
      .map((row) => row.sourceId as string | null)
      .filter((id): id is string => Boolean(id));
    const sources = await prisma.source.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, title: true },
    });
    const titleById = new Map(sources.map((source) => [source.id, source.title]));

    return rows.map((row) => {
      const id = row.sourceId as string | null;
      return {
        id,
        label: id ? (titleById.get(id) ?? "Unknown source") : "No source",
        count: row._count._all,
      };
    });
  }

  private async groupPipelineEntry(
    where: Where,
    column: "pipelineId" | "stageId"
  ): Promise<AggregateRow[]> {
    const grouped = await prisma.pipelineEntry.groupBy({
      by: [column],
      where: { enquiry: where },
      _count: { _all: true },
    } as Prisma.PipelineEntryGroupByArgs as never);

    const rows = grouped as unknown as Array<Record<string, unknown> & { _count: { _all: number } }>;
    const ids = rows.map((row) => row[column] as string);

    const names =
      column === "pipelineId"
        ? await prisma.pipeline.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : await prisma.stage.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          });

    const nameById = new Map(names.map((entry) => [entry.id, entry.name]));

    return rows.map((row) => {
      const id = row[column] as string;
      return { id, label: nameById.get(id) ?? "Unknown", count: row._count._all };
    });
  }

  private async groupTag(where: Where): Promise<AggregateRow[]> {
    const grouped = await prisma.enquiryTag.groupBy({
      by: ["name"],
      where: { enquiry: where },
      _count: { _all: true },
    });

    return grouped.map((row) => ({
      label: row.name,
      count: row._count._all,
    }));
  }

  private async groupAssignedUser(where: Where): Promise<AggregateRow[]> {
    const grouped = await prisma.enquiryAssignment.groupBy({
      by: ["userId"],
      where: { enquiry: where },
      _count: { _all: true },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((row) => row.userId) } },
      select: { id: true, name: true, email: true },
    });
    const nameById = new Map(users.map((user) => [user.id, user.name ?? user.email]));

    return grouped.map((row) => ({
      id: row.userId,
      label: nameById.get(row.userId) ?? "Unknown user",
      count: row._count._all,
    }));
  }

  /// Grouped in memory: `city` lives on the related customer, and Prisma's
  /// `groupBy` can only group by columns of the model being queried.
  private async groupCity(where: Where): Promise<AggregateRow[]> {
    const rows = await prisma.enquiry.findMany({
      where,
      select: { customer: { select: { city: true } } },
      take: IN_MEMORY_GROUP_LIMIT,
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      const city = row.customer.city?.trim() || "Not set";
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }

    return [...counts].map(([label, count]) => ({ label, count }));
  }

  /// Also grouped in memory: bucketing a timestamp by week or month needs
  /// `date_trunc`, which `groupBy` has no expression for.
  private async groupTime(
    where: Where,
    unit: TimeUnit,
    field: "createdAt" | "updatedAt" | "valuedAt"
  ): Promise<AggregateRow[]> {
    const rows = await prisma.enquiry.findMany({
      where: { AND: [where, { [field]: { not: null } }] },
      select: { [field]: true } as Prisma.EnquirySelect,
      take: IN_MEMORY_GROUP_LIMIT,
    });

    const counts = new Map<string, number>();
    for (const row of rows as unknown as Array<Record<string, Date | null>>) {
      const date = row[field];
      if (!date) continue;
      counts.set(bucketKey(date, unit), (counts.get(bucketKey(date, unit)) ?? 0) + 1);
    }

    return [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, count }));
  }
}

function bucketKey(date: Date, unit: TimeUnit): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  switch (unit) {
    case "year":
      return String(year);
    case "month":
      return `${year}-${month}`;
    case "week": {
      // ISO week: Thursday of the same week decides the year and number.
      const thursday = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
      thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
      const week = Math.ceil(
        ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
      );
      return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    }
    case "day":
    default:
      return `${year}-${month}-${day}`;
  }
}

export default EnquiryAggregationBuilder;
