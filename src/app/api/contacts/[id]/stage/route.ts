import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";
import { ENQUIRY_INCLUDE, serializeEnquiry } from "@/app/lib/enquiry/serialize";

interface UpdateStageRequest {
  stageId: string;
  /// Position within the destination column. Omitted means "append".
  order?: number;
  pipelineId?: string;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(request);

    let isAdmin = false;
    try {
      authorizeRoles(user, "admin");
      isAdmin = true;
    } catch {
      try {
        authorizeRoles(user, "team_member");
      } catch {
        return NextResponse.json(
          { success: false, error: "User is neither admin nor team member" },
          { status: 401 }
        );
      }
    }

    const { id } = await context.params;
    const body: UpdateStageRequest = await request.json();
    const { stageId } = body;

    if (!stageId) {
      return NextResponse.json(
        { success: false, error: "Missing stage ID" },
        { status: 400 }
      );
    }

    const pipelineId = body.pipelineId || process.env.DEFAULT_PIPELINE;
    if (!pipelineId) {
      return NextResponse.json(
        { success: false, error: "No pipeline configured" },
        { status: 500 }
      );
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      select: { id: true, assignedTo: { select: { userId: true } } },
    });

    if (
      !enquiry ||
      (!isAdmin && !enquiry.assignedTo.some((a) => a.userId === user.id))
    ) {
      return NextResponse.json(
        { success: false, error: "Enquiry not found or unauthorized" },
        { status: 404 }
      );
    }

    const entry = await prisma.pipelineEntry.findUnique({
      where: { enquiryId_pipelineId: { enquiryId: id, pipelineId } },
      include: { stage: { select: { id: true, name: true } } },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Enquiry is not associated with the specified pipeline" },
        { status: 400 }
      );
    }

    const stage = await prisma.stage.findFirst({
      where: { id: stageId, pipelineId },
      select: { id: true, name: true, probability: true },
    });

    if (!stage) {
      return NextResponse.json(
        { success: false, error: "Stage not found or does not belong to the pipeline" },
        { status: 400 }
      );
    }

    if (entry.stageId === stage.id && body.order === undefined) {
      return NextResponse.json(
        { success: true, contact: null, message: "Enquiry is already in this stage" },
        { status: 200 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.pipelineEntry.update({
        where: { id: entry.id },
        data: {
          stageId: stage.id,
          ...(body.order !== undefined && { order: body.order }),
        },
      });

      // The stage carries the odds of closing, so moving a card moves the
      // enquiry's probability with it — the board is the source of truth.
      const result = await tx.enquiry.update({
        where: { id },
        data: { probability: stage.probability },
        include: ENQUIRY_INCLUDE,
      });

      await tx.enquiryActivity.create({
        data: {
          enquiryId: id,
          userId: user.id,
          action: "PIPELINE_STAGE_UPDATED",
          details: { fromStage: entry.stage.name, toStage: stage.name },
        },
      });

      return result;
    });

    return NextResponse.json(
      { success: true, contact: serializeEnquiry(updated) },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error updating enquiry stage:", error);
    return NextResponse.json(
      { success: false, error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
