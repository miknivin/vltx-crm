"use server";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { hashPassword, hashResetToken } from "@/app/lib/auth/password";
import sendToken from "@/app/api/utils/sendToken";

interface ResetPasswordRequest {
  password: string;
  confirmPassword: string;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    let body: ResetPasswordRequest;
    try {
      body = await req.json();
    } catch (error: unknown) {
      console.error("JSON parsing error:", error);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { password, confirmPassword } = body;

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { error: "Password and confirmPassword are required" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Password does not match" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashResetToken(token),
        resetPasswordExpire: { gt: new Date() },
      },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Password reset token is invalid or has expired" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(password),
        resetPasswordToken: null,
        resetPasswordExpire: null,
      },
    });

    return sendToken(user, 200);
  } catch (error: unknown) {
    console.error("Error in reset password:", error);
    return NextResponse.json({ error: "Could not reset the password" }, { status: 500 });
  }
}
