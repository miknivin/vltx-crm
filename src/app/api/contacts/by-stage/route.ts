import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { isAuthenticatedUser } from "../../middlewares/auth";
import {
  buildEnquiryWhere,
  FilterValidationError,
} from "@/app/lib/enquiry/buildFilterWhere";
import { ENQUIRY_INCLUDE, serializeEnquiry } from "@/app/lib/enquiry/serialize";
import { UnknownFieldError } from "@/app/classes/EnquiryFilterBuilder";
import { ByStageApiError } from "./types";
import { parseAndValidateByStageParams } from "./validation";

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    const params = parseAndValidateByStageParams(req);

    const filterWhere = await buildEnquiryWhere(params.filter, {
      // Scope for everyone who is not an admin, not just team members —
      // any other role would otherwise see the whole board.
      restrictToUserId: user.role === "admin" ? undefined : user.id,
      keyword: params.keyword,
    });

    // Query the board position itself, not the enquiry: `order` lives on the
    // pipeline entry, and Prisma cannot sort a parent by a to-many relation's
    // column. Paginating the entries keeps the column order correct across
    // pages, which sorting each page in memory would not.
    const where = {
      pipelineId: params.pipelineId,
      stageId: params.stageId,
      enquiry: filterWhere,
    };

    const [entries, total] = await Promise.all([
      prisma.pipelineEntry.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { enquiry: { include: ENQUIRY_INCLUDE } },
      }),
      prisma.pipelineEntry.count({ where }),
    ]);

    const contacts = entries.map((entry) => ({
      ...serializeEnquiry(entry.enquiry),
      order: entry.order,
    }));

    return NextResponse.json(
      {
        contacts,
        total,
        page: params.page,
        limit: params.limit,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof ByStageApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FilterValidationError || error instanceof UnknownFieldError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error fetching enquiries by stage:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
