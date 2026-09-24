import { NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { serializePipeline } from "@/app/lib/enquiry/serializePipeline";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    return NextResponse.json({ pipeline: serializePipeline(pipeline) }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error fetching pipeline by ID:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
