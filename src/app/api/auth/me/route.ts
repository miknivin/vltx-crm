import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedUser } from "../../middlewares/auth";
import { serializeUser } from "@/app/lib/auth/serializeUser";

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    return NextResponse.json(
      { success: true, user: serializeUser(user) },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ success: false, message: errorMessage }, { status: 401 });
  }
}
