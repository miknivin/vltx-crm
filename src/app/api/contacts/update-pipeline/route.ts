import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { isAuthenticatedUser, authorizeRoles } from "../../middlewares/auth";

interface UpdatePipelineRequest {
  contactIds: string[];
  pipelineId: string;
  stageId: string;
}

/// Moves a set of enquiries onto a pipeline stage in bulk — used by the list
/// view's "add to pipeline" action, as opposed to the board's drag handler.
export async function PATCH(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const body: UpdatePipelineRequest = await req.json();
    const { contactIds, pipelineId, stageId } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds must be a non-empty array" },
        { status: 400 }
      );
    }
    if (!pipelineId || !stageId) {
      return NextResponse.json(
        { error: "pipelineId and stageId are required" },
        { status: 400 }
      );
    }

    const [pipeline, stage, enquiries] = await Promise.all([
      prisma.pipeline.findUnique({
        where: { id: pipelineId },
        select: { id: true, name: true },
      }),
      prisma.stage.findFirst({
        where: { id: stageId, pipelineId },
        select: { id: true, name: true, probability: true },
      }),
      prisma.enquiry.findMany({
        where: { id: { in: contactIds } },
        select: {
          id: true,
          pipelineEntries: {
            where: { pipelineId },
            select: { id: true, stage: { select: { name: true } } },
          },
        },
      }),
    ]);

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }
    if (!stage) {
      return NextResponse.json(
        { error: "Stage not found or does not belong to the pipeline" },
        { status: 404 }
      );
    }
    if (enquiries.length !== new Set(contactIds).size) {
      return NextResponse.json(
        { error: "One or more enquiries not found" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const activities: Prisma.EnquiryActivityCreateManyInput[] = [];

      for (const enquiry of enquiries) {
        const existing = enquiry.pipelineEntries[0];

        await tx.pipelineEntry.upsert({
          where: { enquiryId_pipelineId: { enquiryId: enquiry.id, pipelineId } },
          update: { stageId: stage.id },
          create: { enquiryId: enquiry.id, pipelineId, stageId: stage.id, order: 0 },
        });

        await tx.enquiry.update({
          where: { id: enquiry.id },
          data: { probability: stage.probability },
        });

        activities.push({
          enquiryId: enquiry.id,
          userId: user.id,
          action: existing ? "PIPELINE_STAGE_UPDATED" : "PIPELINE_ADDED",
          details: {
            pipelineName: pipeline.name,
            ...(existing
              ? { oldStageName: existing.stage.name, newStageName: stage.name }
              : { stageName: stage.name }),
          },
        });
      }

      await tx.enquiryActivity.createMany({ data: activities });
    });

    return NextResponse.json(
      { success: true, updated: enquiries.length },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error updating enquiry pipeline:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
