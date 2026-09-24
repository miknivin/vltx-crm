import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { isAuthenticatedUser, authorizeRoles } from "../../middlewares/auth";
import prisma from "@/app/lib/db/prisma";

type StoredAiResponse = {
  results?: Array<{ step?: { ui?: { type?: string } } }>;
};

export async function GET(request: NextRequest) {
  try {
    const user = await isAuthenticatedUser(request);
    authorizeRoles(user, "admin", "team_member");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 20), 100);
    const sessionId = searchParams.get("sessionId")?.trim();
    const direction = searchParams.get("sort") === "asc" ? "asc" : "desc";

    const where: Prisma.AiReportSessionMessageWhereInput = {
      userId: user.id,
      ...(sessionId && { session: { sessionId } }),
    };

    const history = await prisma.aiReportSessionMessage.findMany({
      where,
      orderBy: { createdAt: direction },
      take: limit,
      include: { session: { select: { sessionId: true } } },
    });

    const items = history.map((item) => ({
      id: item.id,
      queryText: item.queryTextDisplay || item.queryText,
      sessionId: item.session.sessionId,
      toolRequest: item.toolRequest,
      response: item.response,
      uiType: (item.response as StoredAiResponse | null)?.results?.[0]?.step?.ui?.type,
      updatedAt: item.createdAt,
    }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load history";
    const status = message === "Not allowed" ? 403 : message.includes("login") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const runtime = "nodejs";
