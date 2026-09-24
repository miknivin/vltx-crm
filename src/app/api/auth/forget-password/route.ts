"use server";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { createResetPasswordToken } from "@/app/lib/auth/password";
import { sendPasswordResetEmail } from "../../utils/sendResetPasswordEmail";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase() },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found with this email" },
        { status: 401 }
      );
    }

    const { resetToken, resetPasswordToken, resetPasswordExpire } =
      createResetPasswordToken();

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken, resetPasswordExpire },
    });

    await sendPasswordResetEmail(email, resetToken);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error in forgot password:", error);
    return NextResponse.json(
      { error: "Could not start a password reset" },
      { status: 500 }
    );
  }
}
