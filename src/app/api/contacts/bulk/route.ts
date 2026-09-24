import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "../../middlewares/auth";
import { createEnquiry, EnquiryInputError } from "@/app/lib/enquiry/createEnquiry";

interface PayloadRow {
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  tags?: string;
  isDuplicate?: boolean;
  source?: string;

  // Asset columns, matching the website form's vocabulary.
  category?: string;
  jewelleryType?: string;
  brand?: string;
  metalWeight?: string | number;
  carat?: string | number;
  shapeCut?: string;
  condition?: string;
  certificateAvailable?: string;
  certificateLab?: string;
  purchaseYear?: string | number;
  description?: string;
}

interface BulkPayload {
  contacts: PayloadRow[];
  assignedUsers: string[];
  assignType: "every" | "equally" | "roundRobin";
  addToPipeline: boolean;
  /// Applied to every row without its own mapped source.
  source?: string;
  /// Used when a row's spreadsheet has no category column.
  defaultCategory?: string;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await isAuthenticatedUser(request);
    authorizeRoles(currentUser, "admin");

    const payload: BulkPayload = await request.json();

    if (!payload.contacts || !Array.isArray(payload.contacts)) {
      return NextResponse.json({ error: "Invalid contacts array" }, { status: 400 });
    }
    if (!payload.assignedUsers || !Array.isArray(payload.assignedUsers)) {
      return NextResponse.json({ error: "Invalid assignedUsers array" }, { status: 400 });
    }
    if (!["every", "equally", "roundRobin"].includes(payload.assignType)) {
      return NextResponse.json({ error: "Invalid assignType" }, { status: 400 });
    }

    if (payload.assignedUsers.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: payload.assignedUsers } },
        select: { id: true },
      });
      if (users.length !== new Set(payload.assignedUsers).size) {
        return NextResponse.json(
          { error: "One or more assignedUsers not found" },
          { status: 400 }
        );
      }
    }

    const assigneeFor = (index: number): string | null => {
      if (!payload.assignedUsers.length) return null;
      // `every` cannot be expressed one-assignee-at-a-time here, so it is
      // applied as a follow-up assignment below.
      if (payload.assignType === "every") return null;
      return payload.assignedUsers[index % payload.assignedUsers.length];
    };

    const created: string[] = [];
    const failed: { contact: PayloadRow; error: string }[] = [];

    // Sequential rather than Promise.all: rows sharing a mobile number must
    // resolve to the same customer, and concurrent upserts on that unique
    // column would race each other into constraint violations.
    for (const [index, row] of payload.contacts.entries()) {
      try {
        if (row.isDuplicate) {
          failed.push({ contact: row, error: "Skipped as duplicate" });
          continue;
        }

        const enquiry = await createEnquiry(
          {
            name: row.name,
            mobile: row.mobile ?? row.phone ?? "",
            email: row.email,
            city: row.city,
            category: row.category ?? payload.defaultCategory ?? "Other Luxury Asset",
            jewelleryType: row.jewelleryType,
            brand: row.brand,
            metalWeight: row.metalWeight,
            carat: row.carat,
            shapeCut: row.shapeCut,
            condition: row.condition,
            certificateAvailable: row.certificateAvailable,
            certificateLab: row.certificateLab,
            purchaseYear: row.purchaseYear,
            description: row.description,
            tags: row.tags
              ? row.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
              : undefined,
            sourceTitle: row.source ?? payload.source,
            assignToUserId: assigneeFor(index),
          },
          currentUser.id
        );

        created.push(enquiry.id);
      } catch (error: unknown) {
        failed.push({
          contact: row,
          error:
            error instanceof EnquiryInputError
              ? error.message
              : "Could not import this row",
        });
      }
    }

    if (payload.assignType === "every" && payload.assignedUsers.length && created.length) {
      await prisma.enquiryAssignment.createMany({
        data: created.flatMap((enquiryId) =>
          payload.assignedUsers.map((userId) => ({ enquiryId, userId }))
        ),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(
      {
        message: "Bulk import complete",
        createdCount: created.length,
        failedCount: failed.length,
        failed,
      },
      { status: created.length ? 201 : 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error bulk-importing enquiries:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
