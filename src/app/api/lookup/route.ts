import { NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";

/// Resolves a bare id found inside an activity's `details` JSON into
/// something a person can read. Used by the activity timeline, which stores
/// ids for relationships that have no display value of their own.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const objectId = searchParams.get("objectId");
    const key = searchParams.get("key");

    if (!objectId || !key) {
      return NextResponse.json({ error: "Missing objectId or key" }, { status: 400 });
    }

    if (key.toLowerCase().includes("user ids")) {
      const user = await prisma.user.findUnique({
        where: { id: objectId },
        select: { name: true },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({ objectId, key, name: user.name || "Unknown" });
    }

    return NextResponse.json({
      message: "Key does not require user lookup",
      objectId,
      key,
    });
  } catch (error) {
    console.error("Error in /api/lookup:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
