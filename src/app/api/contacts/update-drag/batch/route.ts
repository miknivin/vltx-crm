import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";
import { BatchUpdateItem, entryKey, validateBatchUpdates } from "./validation";

interface BatchUpdateRequest {
  updates: BatchUpdateItem[];
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    let body: BatchUpdateRequest;
    try {
      body = (await req.json()) as BatchUpdateRequest;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const updates = body.updates ?? [];
    const { entries, stageNames, pipelineNames } = await validateBatchUpdates(updates);

    // The drag-sync worker on the frontend coalesces rapid moves and flushes
    // a backlog after coming back online, so this is a batch even though the
    // common case is a single card.
    await prisma.$transaction(async (tx) => {
      const activities: Prisma.EnquiryActivityCreateManyInput[] = [];

      for (const update of updates) {
        const existing = entries.get(entryKey(update.contactId, update.pipelineId))!;

        await tx.pipelineEntry.update({
          where: { id: existing.id },
          data: { stageId: update.stageId, order: update.order },
        });

        if (existing.stageId === update.stageId) continue;

        // Reordering within a column is not a stage change, so only a real
        // move between columns earns a timeline entry.
        activities.push({
          enquiryId: update.contactId,
          userId: user.id,
          action: "PIPELINE_STAGE_UPDATED",
          details: {
            pipelineName: pipelineNames.get(update.pipelineId) ?? update.pipelineId,
            oldStageName: existing.stageName,
            newStageName: stageNames.get(update.stageId) ?? update.stageId,
            order: update.order,
            updatedBy: user.name,
          },
        });
      }

      const movedStages = updates.filter(
        (update) =>
          entries.get(entryKey(update.contactId, update.pipelineId))!.stageId !==
          update.stageId
      );

      if (movedStages.length) {
        const stageProbabilities = await tx.stage.findMany({
          where: { id: { in: movedStages.map((update) => update.stageId) } },
          select: { id: true, probability: true },
        });
        const probabilityByStage = new Map(
          stageProbabilities.map((stage) => [stage.id, stage.probability])
        );

        await Promise.all(
          movedStages.map((update) =>
            tx.enquiry.update({
              where: { id: update.contactId },
              data: { probability: probabilityByStage.get(update.stageId) ?? undefined },
            })
          )
        );
      }

      if (activities.length) {
        await tx.enquiryActivity.createMany({ data: activities });
      }
    });

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Error updating enquiry board positions:", error);

    const status =
      message.includes("login") || message.includes("Not allowed")
        ? 401
        : message.includes("not on pipeline") ||
            message.includes("does not belong") ||
            message.includes("must be") ||
            message.includes("Invalid")
          ? 400
          : 500;

    return NextResponse.json(
      { error: status === 500 ? "Internal server error" : message },
      { status }
    );
  }
}
