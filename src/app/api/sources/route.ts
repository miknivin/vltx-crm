import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";

/// Where a VLTX enquiry can come from. Seeded on first read so a fresh
/// deployment has usable options without anyone remembering to run the seed.
const DEFAULT_SOURCES = [
  "Website Valuation Form",
  "Walk-in",
  "Referral",
  "Phone Enquiry",
  "WhatsApp",
  "Instagram",
  "Manual Entry",
];

async function ensureDefaultSources() {
  const count = await prisma.source.count();
  if (count > 0) return;

  await prisma.source.createMany({
    data: DEFAULT_SOURCES.map((title) => ({ title })),
    // Ignore a race with a concurrent first request.
    skipDuplicates: true,
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    await ensureDefaultSources();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 20), 1), 50);

    const sources = await prisma.source.findMany({
      where: search ? { title: { contains: search, mode: "insensitive" } } : {},
      orderBy: { title: "asc" },
      take: limit,
    });

    return NextResponse.json(
      {
        sources: sources.map((source) => ({
          _id: source.id,
          title: source.title,
          createdAt: source.createdAt,
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error fetching sources:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Source title is required" }, { status: 400 });
    }
    if (title.length > 100) {
      return NextResponse.json(
        { error: "Source title cannot exceed 100 characters" },
        { status: 400 }
      );
    }

    // Typing "whatsapp" when "WhatsApp" exists selects the existing one
    // rather than creating a near-duplicate.
    const existing = await prisma.source.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json(
        {
          message: "Source already exists",
          source: { _id: existing.id, title: existing.title },
        },
        { status: 200 }
      );
    }

    const source = await prisma.source.create({ data: { title } });
    return NextResponse.json(
      {
        message: "Source created successfully",
        source: { _id: source.id, title: source.title },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Source already exists" }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error creating source:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
