import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "../../middlewares/auth";
import { validateUserInput } from "../../middlewares/validateTeamMember";
import { hashPassword } from "@/app/lib/auth/password";
import {
  serializeUser,
  toDbSignupMethod,
  type ApiSignupMethod,
  type ApiUser,
} from "@/app/lib/auth/serializeUser";
import { getSuccessStageIds } from "@/app/lib/utils/successStages";

interface CreateUserRequest {
  name?: string;
  email: string;
  phone: string;
  password?: string;
  signupMethod?: ApiSignupMethod;
  avatar?: {
    public_id: string;
    url: string;
  };
}

interface TeamMemberSummary extends ApiUser {
  /// Enquiries currently assigned to this member, and how many of those have
  /// reached a success stage — the two numbers the team list shows.
  assignedEnquiries: number;
  closedEnquiries: number;
}

interface TeamMembersResponse {
  success: boolean;
  users: TeamMemberSummary[];
  page: number;
  totalPages: number;
  total: number;
}

export async function POST(req: NextRequest) {
  try {
    const reqUser = await isAuthenticatedUser(req);

    try {
      authorizeRoles(reqUser, "admin");
    } catch {
      return NextResponse.json(
        { error: "Only admins can create team members" },
        { status: 401 }
      );
    }

    let body: CreateUserRequest;
    try {
      body = await req.json();
    } catch (error) {
      console.log(error);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    validateUserInput(body);

    const {
      name,
      email,
      phone,
      password,
      signupMethod = "Email/Password",
      avatar,
    } = body;

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone.replace(/\D/g, ""))) {
      return NextResponse.json(
        {
          error:
            "Invalid Indian phone number. Must be 10 digits starting with 6, 7, 8, or 9",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        password:
          signupMethod === "Email/Password" && password
            ? await hashPassword(password)
            : null,
        signupMethod: toDbSignupMethod(signupMethod),
        role: "team_member",
        avatarPublicId: avatar?.public_id ?? null,
        avatarUrl: avatar?.url ?? null,
      },
    });

    return NextResponse.json({ success: true, user: serializeUser(user) }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating team member:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    if (error instanceof Error) {
      if (
        error.message.includes("is required") ||
        error.message.includes("Invalid signup method") ||
        error.message.includes("Avatar must include")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes("login") || error.message.includes("Not allowed")) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);

    try {
      authorizeRoles(user, "admin");
    } catch (error) {
      console.log(error);
      return NextResponse.json(
        { error: "Only admins can view team members" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";

    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { error: "Page and limit must be positive numbers" },
        { status: 400 }
      );
    }

    const where: Prisma.UserWhereInput = { role: "team_member" };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [rows, total, closedStageIds] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
      getSuccessStageIds(),
    ]);

    const userIds = rows.map((row) => row.id);

    // Two grouped counts instead of a per-user query pair: the Mongo version
    // issued 2N round trips to build this page, which is the kind of thing a
    // join-capable database should not be asked to do.
    const [assignedCounts, closedCounts] = await Promise.all([
      prisma.enquiryAssignment.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      closedStageIds.length
        ? prisma.enquiryAssignment.groupBy({
            by: ["userId"],
            where: {
              userId: { in: userIds },
              enquiry: { pipelineEntries: { some: { stageId: { in: closedStageIds } } } },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const assignedByUser = new Map(assignedCounts.map((r) => [r.userId, r._count._all]));
    const closedByUser = new Map(closedCounts.map((r) => [r.userId, r._count._all]));

    const users: TeamMemberSummary[] = rows.map((row) => ({
      ...serializeUser(row),
      assignedEnquiries: assignedByUser.get(row.id) ?? 0,
      closedEnquiries: closedByUser.get(row.id) ?? 0,
    }));

    const response: TeamMembersResponse = {
      success: true,
      users,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error("Error fetching team members:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login") || message.includes("Not allowed")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
