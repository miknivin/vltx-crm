import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "../../../middlewares/auth";

interface UpdateEnquiryNotesRequest {
  tags?: { name: string }[];
  notes?: string;
}

async function requireStaff(request: NextRequest) {
  const user = await isAuthenticatedUser(request);
  try {
    authorizeRoles(user, "admin", "team_member");
  } catch {
    throw new Error("User is neither admin nor team_member");
  }
  return user;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff(request);
    const { id } = await context.params;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      select: {
        notes: true,
        tags: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!enquiry) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        message: "Enquiry notes and tags retrieved successfully",
        notes: enquiry.notes,
        tags: enquiry.tags.map((tag) => ({
          _id: tag.id,
          name: tag.name,
          user: tag.userId,
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login") || message.includes("neither admin")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error retrieving enquiry notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireStaff(request);
    const { id } = await context.params;
    const body: UpdateEnquiryNotesRequest = await request.json();
    const { tags, notes } = body;

    const existing = await prisma.enquiry.findUnique({
      where: { id },
      select: { id: true, notes: true, tags: { select: { name: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    const oldTags = existing.tags.map((tag) => tag.name);
    const newTags = tags?.map((tag) => tag.name);
    const addedTags = newTags?.filter((tag) => !oldTags.includes(tag)) ?? [];
    const removedTags = newTags ? oldTags.filter((tag) => !newTags.includes(tag)) : [];

    const updated = await prisma.$transaction(async (tx) => {
      const data: Prisma.EnquiryUpdateInput = {};
      if (notes !== undefined) data.notes = notes || null;
      if (newTags) {
        data.tags = {
          deleteMany: {},
          create: newTags.map((name) => ({ name, userId: currentUser.id })),
        };
      }

      const enquiry = await tx.enquiry.update({
        where: { id },
        data,
        select: {
          notes: true,
          tags: { select: { id: true, name: true, userId: true } },
        },
      });

      const activities: Prisma.EnquiryActivityCreateManyInput[] = [];
      if (addedTags.length) {
        activities.push({
          enquiryId: id,
          userId: currentUser.id,
          action: "TAG_ADDED",
          details: { addedTags },
        });
      }
      if (removedTags.length) {
        activities.push({
          enquiryId: id,
          userId: currentUser.id,
          action: "TAG_REMOVED",
          details: { removedTags },
        });
      }
      if (notes !== undefined && notes !== existing.notes) {
        activities.push({
          enquiryId: id,
          userId: currentUser.id,
          action: existing.notes ? "NOTE_UPDATED" : "NOTE_ADDED",
          details: { notes },
        });
      }
      if (activities.length) {
        await tx.enquiryActivity.createMany({ data: activities });
      }

      return enquiry;
    });

    return NextResponse.json(
      {
        message: "Enquiry updated successfully",
        notes: updated.notes,
        tags: updated.tags.map((tag) => ({
          _id: tag.id,
          name: tag.name,
          user: tag.userId,
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login") || message.includes("neither admin")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Error updating enquiry notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
