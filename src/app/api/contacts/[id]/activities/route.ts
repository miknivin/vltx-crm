import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";

/// Mongo needed a `$unionWith` across the ActivityLog collection and the
/// Contact document's embedded `activities` array, then a `$lookup` to resolve
/// names. Both sources are now rows in `enquiry_activities`, so the merged,
/// sorted, paginated feed is one query with a join.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const { id } = await context.params;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!enquiry) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 5), 1), 50);

    const where = { enquiryId: id };

    const [rows, total] = await Promise.all([
      prisma.enquiryActivity.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.enquiryActivity.count({ where }),
    ]);

    return NextResponse.json(
      {
        activities: rows.map((row) => ({
          _id: row.id,
          action: row.action,
          details: row.details,
          createdAt: row.createdAt,
          user: row.user
            ? { _id: row.user.id, name: row.user.name, email: row.user.email }
            : null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("login") || message.includes("Not allowed")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error fetching enquiry activities:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
