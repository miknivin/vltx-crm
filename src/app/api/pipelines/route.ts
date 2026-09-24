import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "../middlewares/auth";
import { validatePipelineCreate } from "../middlewares/validatePipelineCreate";
import { validatePipelineQueryParams, PipelineQueryParams } from "../middlewares/validatePipelineQueryParams";
import { serializePipeline } from "@/app/lib/enquiry/serializePipeline";

export async function POST(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin");

    const { name, notes, userId, stages } = await req.json();

    const validationResult = validatePipelineCreate({ name, notes, userId, stages });
    if (validationResult.error) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        name: name.trim(),
        notes: notes?.trim() || null,
        userId: userId ?? user.id,
        ...(stages?.length && {
          stages: {
            create: stages.map(
              (stage: {
                name: string;
                order: number;
                probability: number;
                isSuccess?: boolean;
              }) => ({
                name: stage.name.trim(),
                order: stage.order,
                probability: stage.probability,
                isSuccess: Boolean(stage.isSuccess),
              })
            ),
          },
        }),
      },
      include: { stages: true, user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ pipeline: serializePipeline(pipeline) }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Pipeline name already exists" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login") || message.includes("Not allowed")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error creating pipeline:", error);
    return NextResponse.json({ error: "Failed to create pipeline" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await isAuthenticatedUser(request);
    try {
      authorizeRoles(user, "admin", "team_member");
    } catch {
      return NextResponse.json(
        { error: "User is neither admin or team member" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawParams: PipelineQueryParams = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "10",
      search: searchParams.get("search") || "",
      createdFrom: searchParams.get("createdFrom") || "",
      createdTo: searchParams.get("createdTo") || "",
    };

    const { page, limit, search, createdFrom, createdTo } =
      validatePipelineQueryParams(rawParams);

    const where: Prisma.PipelineWhereInput = {};
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (createdFrom || createdTo) {
      where.createdAt = {
        ...(createdFrom && { gte: createdFrom }),
        ...(createdTo && { lte: createdTo }),
      };
    }

    const [pipelines, total] = await Promise.all([
      prisma.pipeline.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pipeline.count({ where }),
    ]);

    return NextResponse.json(
      {
        pipelines: pipelines.map(serializePipeline),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login") || message.includes("Not allowed")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error fetching pipelines:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
