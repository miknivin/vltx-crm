import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "../../middlewares/auth";

interface AssignEnquiriesRequest {
  contactIds: string[];
  userIds: string[];
  assignType: "every" | "equally" | "roundRobin";
  /// Also (re)place each enquiry at the top of the default pipeline.
  isAddAsNewLead?: boolean;
}

/// Who each enquiry ends up assigned to, by strategy:
/// - `every`      — all selected people on every enquiry
/// - `equally`    — split into even blocks, remainder spread one each
/// - `roundRobin` — dealt out one at a time
function planAssignments(
  enquiryIds: string[],
  userIds: string[],
  assignType: AssignEnquiriesRequest["assignType"]
): Map<string, string[]> {
  const plan = new Map<string, string[]>();

  if (assignType === "every") {
    for (const enquiryId of enquiryIds) plan.set(enquiryId, [...userIds]);
    return plan;
  }

  if (assignType === "roundRobin") {
    enquiryIds.forEach((enquiryId, index) => {
      plan.set(enquiryId, [userIds[index % userIds.length]]);
    });
    return plan;
  }

  const perUser = Math.floor(enquiryIds.length / userIds.length);
  let index = 0;
  for (const userId of userIds) {
    for (let taken = 0; taken < perUser && index < enquiryIds.length; taken += 1) {
      plan.set(enquiryIds[index], [userId]);
      index += 1;
    }
  }
  for (let remainder = index; remainder < enquiryIds.length; remainder += 1) {
    plan.set(enquiryIds[remainder], [userIds[remainder % userIds.length]]);
  }
  return plan;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await isAuthenticatedUser(req);
    authorizeRoles(currentUser, "admin");

    const body: AssignEnquiriesRequest = await req.json();
    const { contactIds, userIds, assignType, isAddAsNewLead = false } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: "Invalid or empty contactIds" }, { status: 400 });
    }
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "Invalid or empty userIds" }, { status: 400 });
    }
    if (!["every", "equally", "roundRobin"].includes(assignType)) {
      return NextResponse.json({ error: "Invalid assignType" }, { status: 400 });
    }

    const [users, enquiries] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      prisma.enquiry.findMany({
        where: { id: { in: contactIds } },
        select: { id: true },
      }),
    ]);

    if (users.length !== new Set(userIds).size) {
      return NextResponse.json({ error: "One or more users not found" }, { status: 404 });
    }
    if (enquiries.length !== new Set(contactIds).size) {
      return NextResponse.json(
        { error: "One or more enquiries not found" },
        { status: 404 }
      );
    }

    const userNameById = new Map(users.map((user) => [user.id, user.name ?? user.id]));

    let pipeline: { id: string; name: string } | null = null;
    let stage: { id: string; name: string } | null = null;

    if (isAddAsNewLead) {
      const pipelineId = process.env.DEFAULT_PIPELINE;
      if (!pipelineId) {
        return NextResponse.json({ error: "No default pipeline configured" }, { status: 400 });
      }
      pipeline = await prisma.pipeline.findUnique({
        where: { id: pipelineId },
        select: { id: true, name: true },
      });
      if (!pipeline) {
        return NextResponse.json({ error: "Default pipeline not found" }, { status: 404 });
      }
      stage = process.env.DEFAULT_STAGE
        ? await prisma.stage.findFirst({
            where: { id: process.env.DEFAULT_STAGE, pipelineId: pipeline.id },
            select: { id: true, name: true },
          })
        : await prisma.stage.findFirst({
            where: { pipelineId: pipeline.id },
            orderBy: { order: "asc" },
            select: { id: true, name: true },
          });
      if (!stage) {
        return NextResponse.json(
          { error: "Default stage not found or does not belong to the pipeline" },
          { status: 404 }
        );
      }
    }

    const plan = planAssignments(contactIds, userIds, assignType);

    await prisma.$transaction(async (tx) => {
      const activities: Prisma.EnquiryActivityCreateManyInput[] = [];

      for (const [enquiryId, assignees] of plan) {
        // Assignment replaces rather than accumulates, matching what the
        // assign drawer shows the person before they confirm.
        await tx.enquiryAssignment.deleteMany({ where: { enquiryId } });
        await tx.enquiryAssignment.createMany({
          data: assignees.map((userId) => ({ enquiryId, userId })),
        });

        activities.push({
          enquiryId,
          userId: currentUser.id,
          action: "ASSIGNED_TO_UPDATED",
          details: {
            assignedUserNames: assignees.map((id) => userNameById.get(id) ?? id),
            assignType,
          },
        });

        if (pipeline && stage) {
          await tx.pipelineEntry.upsert({
            where: { enquiryId_pipelineId: { enquiryId, pipelineId: pipeline.id } },
            update: { stageId: stage.id, order: 0 },
            create: { enquiryId, pipelineId: pipeline.id, stageId: stage.id, order: 0 },
          });

          activities.push({
            enquiryId,
            userId: currentUser.id,
            action: "PIPELINE_ADDED",
            details: { pipelineName: pipeline.name, stageName: stage.name },
          });
        }
      }

      await tx.enquiryActivity.createMany({ data: activities });
    });

    return NextResponse.json(
      { message: "Enquiries assigned successfully" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to assign enquiries";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error assigning enquiries:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Failed to assign enquiries" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
