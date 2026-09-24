import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/app/lib/db/prisma";
import { verifyPassword } from "@/app/lib/auth/password";
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  authCookieOptions,
  signJwtToken,
} from "@/app/lib/auth/token";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedData = signInSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid input data",
          errors: parsedData.error.issues,
        },
        { status: 400 }
      );
    }

    const { email, password } = parsedData.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        uid: true,
        password: true,
      },
    });

    // Same message and status for "no such user" and "wrong password", so the
    // endpoint can't be used to enumerate which addresses have accounts.
    const isPasswordValid = await verifyPassword(password, user?.password ?? null);
    if (!user || !isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const token = signJwtToken(user.id);

    const response = NextResponse.json(
      {
        success: true,
        message: "Sign-in successful",
        user: {
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          uid: user.uid,
        },
      },
      { status: 200 }
    );

    // maxAge is seconds. The Mongo version passed milliseconds here, which the
    // browser clamped to an effectively never-expiring cookie.
    response.cookies.set(AUTH_COOKIE, token, authCookieOptions(SESSION_MAX_AGE_SECONDS));

    return response;
  } catch (error: unknown) {
    console.error("Sign-in error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
