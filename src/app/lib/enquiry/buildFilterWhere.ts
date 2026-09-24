import type { Prisma } from "@prisma/client";
import EnquiryFilterBuilder from "@/app/classes/EnquiryFilterBuilder";
import { findMultiAssigneeEnquiryIds } from "./assigneeCounts";
import { getSuccessStageIds } from "@/app/lib/utils/successStages";
import {
  parseAssetCategory,
  parseCertificateLab,
  parseCondition,
  parseJewelleryType,
  parseShapeCut,
} from "./constants";

export interface DateRange {
  startDate?: string | null;
  endDate?: string | null;
}

export interface NumberRange {
  min?: number | string | null;
  max?: number | string | null;
}

/// The filter panel's payload. Everything is optional — an empty body means
/// "no filters", which is what the unfiltered list and board send.
export interface EnquiryFilterBody {
  assignedTo?: { userId: string; isNot: boolean }[];
  tags?: string[];
  source?: string;
  stage?: string;
  pipelineId?: string;
  createdAt?: DateRange;
  updatedAt?: DateRange;

  // Valuation-specific. These replace the call-outcome "activities" filter,
  // which belonged to the previous client's telecalling workflow and has no
  // counterpart here.
  categories?: string[];
  jewelleryTypes?: string[];
  shapeCuts?: string[];
  conditions?: string[];
  certificateLabs?: string[];
  certificateAvailable?: boolean | "yes" | "no" | null;
  brand?: string;
  estimatedValue?: NumberRange;
  caratWeight?: NumberRange;
  metalWeightG?: NumberRange;
  purchaseYear?: NumberRange;
  /// "valued" = a team member has recorded an estimate.
  valuationStatus?: "valued" | "not_valued";
  conversion?: "converted" | "not_converted";
  assigneeState?: "unassigned" | "assigned" | "multiple";
}

export class FilterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterValidationError";
  }
}

function startOfDay(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new FilterValidationError(`Invalid date: ${value}`);
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new FilterValidationError(`Invalid date: ${value}`);
  }
  date.setHours(23, 59, 59, 999);
  return date;
}

function applyDateRange(
  builder: EnquiryFilterBuilder,
  field: "createdAt" | "updatedAt",
  range: DateRange | undefined
) {
  if (!range) return;
  if (range.startDate) builder.gte(field, startOfDay(range.startDate));
  if (range.endDate) builder.lte(field, endOfDay(range.endDate));
}

function applyNumberRange(
  builder: EnquiryFilterBuilder,
  field: string,
  range: NumberRange | undefined
) {
  if (!range) return;
  if (range.min !== undefined && range.min !== null && range.min !== "") {
    builder.gte(field, Number(range.min));
  }
  if (range.max !== undefined && range.max !== null && range.max !== "") {
    builder.lte(field, Number(range.max));
  }
}

function parseEnumList<T>(
  values: string[] | undefined,
  parse: (value: unknown) => T | null,
  label: string
): T[] {
  if (!values?.length) return [];
  return values.map((value) => {
    const parsed = parse(value);
    if (parsed === null) {
      throw new FilterValidationError(`Invalid ${label}: ${value}`);
    }
    return parsed;
  });
}

export interface BuildFilterOptions {
  /// A non-admin only ever sees their own enquiries, applied before anything
  /// the request asked for so no filter combination can widen it.
  restrictToUserId?: string;
  keyword?: string;
}

/// Turns the filter panel's payload into a `Prisma.EnquiryWhereInput`.
/// Shared by the enquiry list and the pipeline board so the two can never
/// drift into interpreting the same saved filter differently.
export async function buildEnquiryWhere(
  filter: EnquiryFilterBody,
  options: BuildFilterOptions = {}
): Promise<Prisma.EnquiryWhereInput> {
  const builder = EnquiryFilterBuilder.create();

  if (options.restrictToUserId) {
    if (filter.assignedTo?.length) {
      throw new FilterValidationError(
        "Team members can only view their own assigned enquiries"
      );
    }
    builder.assignedTo(options.restrictToUserId);
  } else if (filter.assignedTo?.length) {
    const include = filter.assignedTo.filter((a) => !a.isNot).map((a) => a.userId);
    const exclude = filter.assignedTo.filter((a) => a.isNot).map((a) => a.userId);

    if (include.length) {
      builder.raw({ assignedTo: { some: { userId: { in: include } } } });
    }
    if (exclude.length) {
      builder.raw({ assignedTo: { none: { userId: { in: exclude } } } });
    }
  }

  if (options.keyword) {
    const keyword = options.keyword;
    // Spans the person and the asset, so one box finds "Rolex" and "Priya".
    builder.raw({
      OR: [
        { customer: { name: { contains: keyword, mode: "insensitive" } } },
        { customer: { mobile: { contains: keyword, mode: "insensitive" } } },
        { customer: { email: { contains: keyword, mode: "insensitive" } } },
        { brand: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
        { notes: { contains: keyword, mode: "insensitive" } },
        { tags: { some: { name: { contains: keyword, mode: "insensitive" } } } },
      ],
    });
  }

  if (filter.tags?.length) {
    builder.raw({ tags: { some: { name: { in: filter.tags } } } });
  }

  if (filter.source) builder.eq("source", filter.source);
  if (filter.stage) builder.eq("pipelinesActive.stage_id", filter.stage);
  if (filter.pipelineId) builder.eq("pipelinesActive.pipeline_id", filter.pipelineId);

  applyDateRange(builder, "createdAt", filter.createdAt);
  applyDateRange(builder, "updatedAt", filter.updatedAt);

  const categories = parseEnumList(filter.categories, parseAssetCategory, "category");
  if (categories.length) builder.in("category", categories);

  const jewelleryTypes = parseEnumList(
    filter.jewelleryTypes,
    parseJewelleryType,
    "jewellery type"
  );
  if (jewelleryTypes.length) builder.in("jewelleryType", jewelleryTypes);

  const shapeCuts = parseEnumList(filter.shapeCuts, parseShapeCut, "shape/cut");
  if (shapeCuts.length) builder.in("shapeCut", shapeCuts);

  const conditions = parseEnumList(filter.conditions, parseCondition, "condition");
  if (conditions.length) builder.in("condition", conditions);

  const labs = parseEnumList(filter.certificateLabs, parseCertificateLab, "certificate lab");
  if (labs.length) builder.in("certificateLab", labs);

  if (filter.certificateAvailable !== undefined && filter.certificateAvailable !== null) {
    const wanted =
      typeof filter.certificateAvailable === "boolean"
        ? filter.certificateAvailable
        : filter.certificateAvailable === "yes";
    builder.eq("certificateAvailable", wanted);
  }

  if (filter.brand) builder.contains("brand", filter.brand);

  applyNumberRange(builder, "estimatedValue", filter.estimatedValue);
  applyNumberRange(builder, "caratWeight", filter.caratWeight);
  applyNumberRange(builder, "metalWeightG", filter.metalWeightG);
  applyNumberRange(builder, "purchaseYear", filter.purchaseYear);

  if (filter.valuationStatus === "valued") builder.exists("estimatedValue", true);
  if (filter.valuationStatus === "not_valued") builder.exists("estimatedValue", false);

  if (filter.conversion) {
    builder.setSuccessStageIds(await getSuccessStageIds());
    if (filter.conversion === "converted") builder.isConverted();
    else builder.notConverted();
  }

  switch (filter.assigneeState) {
    case "unassigned":
      builder.unassigned();
      break;
    case "assigned":
      builder.hasAnyAssignee();
      break;
    case "multiple":
      builder.idIn(await findMultiAssigneeEnquiryIds());
      break;
    default:
      break;
  }

  return builder.build();
}
