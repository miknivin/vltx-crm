import { NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";

export async function GET() {
  try {
    const pipelines = await prisma.pipeline.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      {
        success: true,
        data: pipelines.map((pipeline) => ({ _id: pipeline.id, name: pipeline.name })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error fetching pipeline names:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch pipelines" },
      { status: 500 }
    );
  }
}
