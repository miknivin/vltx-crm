import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "../../middlewares/auth";
import {
  buildEnquiryWhere,
  FilterValidationError,
  type EnquiryFilterBody,
} from "@/app/lib/enquiry/buildFilterWhere";
import { ENQUIRY_INCLUDE, serializeEnquiry } from "@/app/lib/enquiry/serialize";
import { UnknownFieldError } from "@/app/classes/EnquiryFilterBuilder";

export async function POST(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);

    let isAdmin = false;
    try {
      authorizeRoles(user, "admin");
      isAdmin = true;
    } catch {
      try {
        authorizeRoles(user, "team_member");
      } catch {
        return NextResponse.json(
          { error: "User is neither admin nor team member" },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const keyword = searchParams.get("keyword") || "";

    if (page < 1 || limit < 1) {
      return NextResponse.json({ error: "Invalid page or limit" }, { status: 400 });
    }

    let filter: EnquiryFilterBody;
    try {
      filter = await req.json();
    } catch (error) {
      console.error("Error parsing filter:", error);
      return NextResponse.json({ error: "Invalid filter format" }, { status: 400 });
    }

    // A `source` query param is still accepted for links built before the
    // filter moved into the request body.
    const sourceParam = searchParams.get("source");
    if (sourceParam && !filter.source) filter.source = sourceParam;
    const stageParam = searchParams.get("stage");
    if (stageParam && !filter.stage) filter.stage = stageParam;

    const where = await buildEnquiryWhere(filter, {
      restrictToUserId: isAdmin ? undefined : user.id,
      keyword,
    });

    const [enquiries, total] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        include: ENQUIRY_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.enquiry.count({ where }),
    ]);

    const contacts = enquiries.map(serializeEnquiry);

    return NextResponse.json(
      {
        message: "Enquiries retrieved successfully",
        // `contacts` is the key the list components already read. The records
        // inside are enquiries.
        contacts,
        enquiries: contacts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof FilterValidationError || error instanceof UnknownFieldError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error fetching enquiries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
