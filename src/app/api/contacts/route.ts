import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { isAuthenticatedUser } from "../middlewares/auth";
import { createEnquiry, EnquiryInputError } from "@/app/lib/enquiry/createEnquiry";
import { ENQUIRY_INCLUDE, serializeEnquiry } from "@/app/lib/enquiry/serialize";

export async function POST(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    const body = await req.json();

    const enquiry = await createEnquiry(
      {
        ...body,
        // The old payload called these `phone` and `businessName`; accept both
        // spellings so existing callers keep working.
        mobile: body.mobile ?? body.phone,
        sourceTitle: body.sourceTitle ?? body.source,
        // A non-admin creating an enquiry owns it immediately — otherwise
        // they would not be able to see the record they just made.
        assignToUserId:
          body.assignToUserId ?? (user.role === "admin" ? null : user.id),
      },
      user.id
    );

    return NextResponse.json(
      {
        message: "Enquiry created and added to pipeline",
        contact: serializeEnquiry(enquiry),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof EnquiryInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error creating enquiry:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const keyword = searchParams.get("keyword")?.trim();

    const where: Prisma.EnquiryWhereInput = {};
    // Scope for every non-admin role, not just team members.
    if (user.role !== "admin") {
      where.assignedTo = { some: { userId: user.id } };
    }
    if (keyword) {
      where.OR = [
        { customer: { name: { contains: keyword, mode: "insensitive" } } },
        { customer: { mobile: { contains: keyword, mode: "insensitive" } } },
        { customer: { email: { contains: keyword, mode: "insensitive" } } },
        { brand: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
      ];
    }

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
        contacts,
        enquiries: contacts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error listing enquiries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
