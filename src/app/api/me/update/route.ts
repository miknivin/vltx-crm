import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { isAuthenticatedUser } from "@/app/api/middlewares/auth";
import { serializeUser } from "@/app/lib/auth/serializeUser";

interface UpdateProfileBody {
  name?: string;
  phone?: string;
  avatar?: { public_id: string; url: string };
}

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await isAuthenticatedUser(req);

    const body = (await req.json()) as UpdateProfileBody;
    const data: Prisma.UserUpdateInput = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.phone !== undefined) data.phone = body.phone.trim();
    if (body.avatar !== undefined) {
      data.avatarPublicId = body.avatar.public_id;
      data.avatarUrl = body.avatar.url;
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Profile updated successfully",
        user: serializeUser(updatedUser),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    console.error("Error updating profile:", error);
    if (message.includes("login") || message.includes("not found")) {
      return NextResponse.json({ message }, { status: 401 });
    }
    return NextResponse.json({ message: "Failed to update profile" }, { status: 500 });
  }
}
