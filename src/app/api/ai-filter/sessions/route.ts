import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedUser, authorizeRoles } from "../../middlewares/auth";
import prisma from "@/app/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await isAuthenticatedUser(request);
    authorizeRoles(user, "admin", "team_member");

    const sessions = await prisma.aiReportSession.findMany({
      where: { userId: user.id },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      select: {
        sessionId: true,
        title: true,
        lastMessageAt: true,
        messageCount: true,
      },
    });

    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sessions";
    const status = message === "Not allowed" ? 403 : message.includes("login") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const runtime = "nodejs";
