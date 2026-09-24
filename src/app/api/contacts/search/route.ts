import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";
import { ASSET_CATEGORY_LABELS } from "@/app/lib/enquiry/constants";
import { encodeReference } from "@/app/lib/enquiry/referenceCode";

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword")?.trim() || "";

    const where: Prisma.EnquiryWhereInput = {};
    // Scope for every non-admin role, not just team members.
    if (user.role !== "admin") {
      where.assignedTo = { some: { userId: user.id } };
    }
    if (keyword) {
      where.OR = [
        { customer: { name: { contains: keyword, mode: "insensitive" } } },
        { customer: { email: { contains: keyword, mode: "insensitive" } } },
        { customer: { mobile: { contains: keyword, mode: "insensitive" } } },
        { brand: { contains: keyword, mode: "insensitive" } },
      ];
    }

    const enquiries = await prisma.enquiry.findMany({
      where,
      select: {
        id: true,
        reference: true,
        category: true,
        brand: true,
        customer: { select: { name: true, email: true, mobile: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json(
      {
        contacts: enquiries.map((enquiry) => ({
          _id: enquiry.id,
          reference: encodeReference(enquiry.reference),
          name: enquiry.customer.name,
          email: enquiry.customer.email,
          phone: enquiry.customer.mobile,
          // The picker shows what the enquiry is about, which is how a person
          // tells two enquiries from the same seller apart.
          businessName: enquiry.brand
            ? `${ASSET_CATEGORY_LABELS[enquiry.category]} · ${enquiry.brand}`
            : ASSET_CATEGORY_LABELS[enquiry.category],
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("login") || message.includes("Not allowed")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error searching enquiries:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
