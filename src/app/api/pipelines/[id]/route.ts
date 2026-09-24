import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/app/lib/db/prisma";
import { isAuthenticatedUser, authorizeRoles } from "../../middlewares/auth";
import { serializePipeline } from "@/app/lib/enquiry/serializePipeline";

const updatePipelineSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  stages: z
    .array(
      z.object({
        stage_id: z.string().optional(), // absent for a newly added stage
        name: z.string().trim().min(3).max(50),
        order: z.number().int().min(0),
        probability: z.number().int().min(0).max(100).optional(),
        isSuccess: z.boolean().optional(),
      })
    )
    .optional(),
});

const validatePipelineUpdate = (data: unknown) => {
  const parsed = updatePipelineSchema.safeParse(data);
  return parsed.success
    ? { data: parsed.data, error: null }
    : { data: null, error: parsed.error.issues };
};

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(request);
    authorizeRoles(user, "admin");

    const pipelineId = (await context.params).id;
    if (!pipelineId) {
      return NextResponse.json({ error: "Pipeline ID is required" }, { status: 400 });
    }

    const validationResult = validatePipelineUpdate(await request.json());
    if (validationResult.error) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    const { name, notes, stages } = validationResult.data ?? {};

    const existing = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.pipeline.update({
        where: { id: pipelineId },
        data: {
          ...(name && { name: name.trim() }),
          ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
        },
      });

      if (stages?.length) {
        // Renumber from 1 so the saved order matches the order the person
        // dragged the stages into, with no gaps to collide on.
        const normalized = [...stages]
          .sort((a, b) => a.order - b.order)
          .map((stage, index) => ({ ...stage, order: index + 1 }));

        const keptIds = normalized
          .map((stage) => stage.stage_id)
          .filter((id): id is string => Boolean(id));

        // Stages dropped from the list go first: `(pipeline_id, order)` is
        // unique, so a removed stage still holding an order would collide
        // with whichever stage slides into its place.
        await tx.stage.deleteMany({
          where: { pipelineId, id: { notIn: keptIds } },
        });

        // Park the survivors on negative orders before writing the real
        // ones, for the same reason: two stages swapping places would
        // otherwise momentarily share an order.
        for (const [index, stage] of normalized.entries()) {
          if (!stage.stage_id) continue;
          await tx.stage.update({
            where: { id: stage.stage_id },
            data: { order: -(index + 1) },
          });
        }

        for (const stage of normalized) {
          const data = {
            name: stage.name.trim(),
            order: stage.order,
            isSuccess: Boolean(stage.isSuccess),
            ...(stage.probability !== undefined && { probability: stage.probability }),
          };

          if (stage.stage_id) {
            await tx.stage.update({ where: { id: stage.stage_id }, data });
          } else {
            await tx.stage.create({ data: { ...data, pipelineId } });
          }
        }
      }

      return tx.pipeline.findUnique({
        where: { id: pipelineId },
        include: {
          stages: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return NextResponse.json(
      { pipeline: updated ? serializePipeline(updated) : null },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Pipeline name already exists" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login") || message.includes("Not allowed")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error updating pipeline:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(request);
    authorizeRoles(user, "admin");

    const pipelineId = (await context.params).id;

    const placed = await prisma.pipelineEntry.count({ where: { pipelineId } });
    if (placed > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete a pipeline with ${placed} enquiries on it. Move them first.`,
        },
        { status: 400 }
      );
    }

    await prisma.pipeline.delete({ where: { id: pipelineId } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login") || message.includes("Not allowed")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error deleting pipeline:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
