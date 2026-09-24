import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ pipelineId: string }> }
) {
  try {
    const { pipelineId } = await context.params;

    if (!pipelineId) {
      return NextResponse.json(
        { success: false, message: "Pipeline ID is required" },
        { status: 400 }
      );
    }

    const stages = await prisma.stage.findMany({
      where: { pipelineId },
      select: { id: true, name: true, order: true, isSuccess: true },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(
      {
        success: true,
        data: stages.map((stage) => ({
          _id: stage.id,
          name: stage.name,
          order: stage.order,
          isSuccess: stage.isSuccess,
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error fetching stages:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch stages" },
      { status: 500 }
    );
  }
}
