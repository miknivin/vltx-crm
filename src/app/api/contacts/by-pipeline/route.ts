import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedUser } from "@/app/api/middlewares/auth";
import prisma from "@/app/lib/db/prisma";
import {
  buildEnquiryWhere,
  FilterValidationError,
  type EnquiryFilterBody,
} from "@/app/lib/enquiry/buildFilterWhere";
import { ENQUIRY_INCLUDE, serializeEnquiry } from "@/app/lib/enquiry/serialize";
import { UnknownFieldError } from "@/app/classes/EnquiryFilterBuilder";

const parseAssignedTo = (raw: string | null): Array<{ _id: string; isNot: boolean }> => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return [{ _id: raw, isNot: false }];
  }
  return [];
};

/// Every enquiry on one pipeline, ordered the way the board reads: by stage,
/// then by card position. Mongo needed a `$lookup` and a computed sort key for
/// this; ordering through the `stage` relation replaces both.
export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);

    const pipelineId = searchParams.get("pipelineId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId is required" }, { status: 400 });
    }
    if (Number.isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
    }
    if (Number.isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit (must be 1-100)" }, { status: 400 });
    }

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (startDate && Number.isNaN(Date.parse(startDate))) {
      return NextResponse.json({ error: "Invalid startDate format" }, { status: 400 });
    }
    if (endDate && Number.isNaN(Date.parse(endDate))) {
      return NextResponse.json({ error: "Invalid endDate format" }, { status: 400 });
    }

    let filter: EnquiryFilterBody = {};
    const filterParam = searchParams.get("filter");
    if (filterParam) {
      try {
        filter = JSON.parse(filterParam);
      } catch {
        return NextResponse.json({ error: "Invalid filter format" }, { status: 400 });
      }
    }

    const assignedTo = parseAssignedTo(searchParams.get("assignedTo"));
    if (assignedTo.length && !filter.assignedTo?.length) {
      filter.assignedTo = assignedTo.map((item) => ({
        userId: item._id,
        isNot: item.isNot,
      }));
    }

    const source = searchParams.get("source");
    if (source && !filter.source) filter.source = source;
    if ((startDate || endDate) && !filter.createdAt) {
      filter.createdAt = { startDate, endDate };
    }

    const enquiryWhere = await buildEnquiryWhere(filter, {
      // Scope for everyone who is not an admin, not just team members —
      // any other role would otherwise see the whole board.
      restrictToUserId: user.role === "admin" ? undefined : user.id,
      keyword: searchParams.get("keyword") || undefined,
    });

    const where = { pipelineId, enquiry: enquiryWhere };

    const [entries, total] = await Promise.all([
      prisma.pipelineEntry.findMany({
        where,
        orderBy: [{ stage: { order: "asc" } }, { order: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: { enquiry: { include: ENQUIRY_INCLUDE } },
      }),
      prisma.pipelineEntry.count({ where }),
    ]);

    const contacts = entries.map((entry) => ({
      ...serializeEnquiry(entry.enquiry),
      order: entry.order,
      // Only this pipeline's placement, matching what the old projection
      // narrowed `pipelinesActive` down to.
      pipelinesActive: [
        {
          _id: entry.id,
          pipeline_id: entry.pipelineId,
          stage_id: entry.stageId,
          order: entry.order,
        },
      ],
    }));

    return NextResponse.json({ contacts, total, page, limit }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof FilterValidationError || error instanceof UnknownFieldError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error fetching enquiries by pipeline:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
