import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { isAuthenticatedUser } from "../middlewares/auth";
import { PREFERRED_CONTACT_LABELS } from "@/app/lib/enquiry/constants";

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const keyword = searchParams.get("keyword")?.trim();

    const where: Prisma.CustomerWhereInput = {};
    // A non-admin only sees people behind an enquiry actually assigned to
    // them — the same scoping the enquiry list applies, one level up.
    if (user.role !== "admin") {
      where.enquiries = { some: { assignedTo: { some: { userId: user.id } } } };
    }
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { mobile: { contains: keyword, mode: "insensitive" } },
        { email: { contains: keyword, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          enquiries: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          _count: { select: { enquiries: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json(
      {
        customers: customers.map((customer) => ({
          _id: customer.id,
          name: customer.name,
          mobile: customer.mobile,
          email: customer.email,
          city: customer.city,
          preferredContact: customer.preferredContact,
          preferredContactLabel: customer.preferredContact
            ? PREFERRED_CONTACT_LABELS[customer.preferredContact]
            : null,
          enquiryCount: customer._count.enquiries,
          lastEnquiryAt: customer.enquiries[0]?.createdAt ?? null,
          createdAt: customer.createdAt,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error listing customers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
