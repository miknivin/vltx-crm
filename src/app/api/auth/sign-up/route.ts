import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { hashPassword } from "@/app/lib/auth/password";
import sendToken from "../../utils/sendToken";

const registerSchema = z.object({
  name: z.string().max(50).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedData = registerSchema.safeParse(body);

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

    const { name, email, password, phone } = parsedData.data;

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        password: await hashPassword(password),
        signupMethod: "EmailPassword",
      },
      select: { id: true, name: true, email: true },
    });

    return sendToken(user, 201);
  } catch (error: unknown) {
    // Let the unique index decide, rather than a prior findFirst that another
    // concurrent signup could slip past between the check and the insert.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "User with this email already exists",
        },
        { status: 400 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
