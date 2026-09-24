import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";

interface UpdateProbabilityRequest {
  probability: number;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(request);
    authorizeRoles(user, "admin", "team_member");

    const { id } = await context.params;
    const { probability } = (await request.json()) as UpdateProbabilityRequest;

    if (typeof probability !== "number" || probability < 0 || probability > 100) {
      return NextResponse.json(
        { success: false, error: "Probability must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    const existing = await prisma.enquiry.findUnique({
      where: { id },
      select: { probability: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const enquiry = await tx.enquiry.update({
        where: { id },
        data: { probability },
        select: { id: true, probability: true },
      });

      await tx.enquiryActivity.create({
        data: {
          enquiryId: id,
          userId: user.id,
          action: "ENQUIRY_UPDATED",
          details: {
            field: "probability",
            oldValue: existing.probability,
            newValue: probability,
          },
        },
      });

      return enquiry;
    });

    return NextResponse.json({
      success: true,
      message: "Probability updated successfully",
      contact: { _id: updated.id, probability: updated.probability },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error updating enquiry probability:", error);
    return NextResponse.json(
      { success: false, error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
