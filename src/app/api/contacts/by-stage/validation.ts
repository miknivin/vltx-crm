import { NextRequest } from "next/server";
import type { EnquiryFilterBody } from "@/app/lib/enquiry/buildFilterWhere";
import {
  ByStageApiError,
  ByStageAssignedToFilter,
  ParsedByStageParams,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeJsonParse = <T>(value: string | null, label: string, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new ByStageApiError(`Invalid ${label} format`);
  }
};

export const parseAndValidateByStageParams = (req: NextRequest): ParsedByStageParams => {
  const { searchParams } = new URL(req.url);

  const pipelineId = searchParams.get("pipelineId") || "";
  const stageId = searchParams.get("stageId") || "";

  if (!pipelineId || !stageId) {
    throw new ByStageApiError("pipelineId and stageId are required");
  }
  if (!UUID.test(pipelineId) || !UUID.test(stageId)) {
    throw new ByStageApiError("Invalid pipelineId or stageId");
  }

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (Number.isNaN(page) || page < 1) {
    throw new ByStageApiError("Invalid page number");
  }
  if (Number.isNaN(limit) || limit < 1 || limit > 100) {
    throw new ByStageApiError("Invalid limit (must be 1-100)");
  }

  const filter = safeJsonParse<EnquiryFilterBody>(searchParams.get("filter"), "filter", {});

  // The board used to send assignedTo as its own param keyed on `_id`;
  // fold it into the shared filter shape, which keys on `userId`.
  const legacyAssignedTo = safeJsonParse<ByStageAssignedToFilter[]>(
    searchParams.get("assignedTo"),
    "assignedTo",
    []
  );
  if (legacyAssignedTo.length && !filter.assignedTo?.length) {
    for (const item of legacyAssignedTo) {
      if (!item?._id || typeof item.isNot !== "boolean" || !UUID.test(item._id)) {
        throw new ByStageApiError("Invalid assignedTo format");
      }
    }
    filter.assignedTo = legacyAssignedTo.map((item) => ({
      userId: item._id,
      isNot: item.isNot,
    }));
  }

  const source = searchParams.get("source");
  if (source && !filter.source) filter.source = source;

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if ((startDate || endDate) && !filter.createdAt) {
    if (startDate && Number.isNaN(Date.parse(startDate))) {
      throw new ByStageApiError("Invalid startDate format");
    }
    if (endDate && Number.isNaN(Date.parse(endDate))) {
      throw new ByStageApiError("Invalid endDate format");
    }
    filter.createdAt = { startDate, endDate };
  }

  return {
    pipelineId,
    stageId,
    keyword: searchParams.get("keyword") || undefined,
    page,
    limit,
    filter,
  };
};
