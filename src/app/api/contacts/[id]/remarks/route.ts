import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const { id } = await context.params;
    const body = await req.json();

    if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "Remark text is required" }, { status: 400 });
    }

    const text = body.text.trim();

    const remark = await prisma.$transaction(async (tx) => {
      const created = await tx.enquiryRemark.create({
        data: { enquiryId: id, text, createdById: user.id },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      });

      await tx.enquiryActivity.create({
        data: {
          enquiryId: id,
          userId: user.id,
          action: "REMARK_ADDED",
          details: { text },
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        message: "Remark added successfully",
        remark: {
          _id: remark.id,
          text: remark.text,
          createdAt: remark.createdAt,
          createdBy: remark.createdBy
            ? {
                _id: remark.createdBy.id,
                name: remark.createdBy.name,
                email: remark.createdBy.email,
              }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    // A remark for an enquiry that no longer exists fails the foreign key
    // rather than silently creating an orphan row.
    if (message.includes("Foreign key") || message.includes("P2003")) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }
    if (message.includes("login") || message.includes("Not allowed")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error adding remark:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
