import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";
import { ENQUIRY_INCLUDE, serializeEnquiry } from "@/app/lib/enquiry/serialize";
import {
  ASSET_CATEGORY_LABELS,
  parseCertificateLab,
  parseCondition,
  parseJewelleryType,
  parsePreferredContact,
  parseShapeCut,
  parseYesNo,
} from "@/app/lib/enquiry/constants";
import { normalizeMobile } from "@/app/lib/enquiry/createEnquiry";

interface UpdateEnquiryRequest {
  // Person
  name?: string;
  email?: string | null;
  phone?: string;
  city?: string | null;
  preferredContact?: string | null;

  // Asset
  jewelleryType?: string | null;
  brand?: string | null;
  metalWeight?: string | number | null;
  carat?: string | number | null;
  shapeCut?: string | null;
  condition?: string | null;
  certificateAvailable?: string | boolean | null;
  certificateLab?: string | null;
  purchaseYear?: string | number | null;
  description?: string | null;

  // Valuation
  estimatedValue?: string | number | null;
  offeredAmount?: string | number | null;

  notes?: string | null;
  source?: string | null;
  tags?: { name: string }[];
}

function optionalNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(request);
    authorizeRoles(user, "admin", "team_member");

    const { id } = await context.params;

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        ...ENQUIRY_INCLUDE,
        remarks: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!enquiry) {
      return NextResponse.json(
        { success: false, error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const tasks = await prisma.task.findMany({
      where: { enquiryId: id },
      include: {
        assignedTo: { include: { user: { select: { id: true, name: true, email: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    // A seller can submit more than one asset — surface their other
    // enquiries so a team member working this one can see the customer's
    // full history rather than a single, seemingly isolated submission.
    const otherEnquiries = await prisma.enquiry.findMany({
      where: { customerId: enquiry.customerId, id: { not: id } },
      select: {
        id: true,
        reference: true,
        category: true,
        brand: true,
        estimatedValue: true,
        createdAt: true,
        pipelineEntries: {
          take: 1,
          select: { stage: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // The activity timeline is served separately and paginated by
    // GET /api/contacts/[id]/activities — it is unbounded, so it does not
    // belong in the detail payload.
    const contact = {
      ...serializeEnquiry(enquiry),
      remarks: enquiry.remarks.map((remark) => ({
        _id: remark.id,
        text: remark.text,
        createdAt: remark.createdAt,
        createdBy: remark.createdBy
          ? { _id: remark.createdBy.id, name: remark.createdBy.name, email: remark.createdBy.email }
          : null,
      })),
    };

    return NextResponse.json({
      success: true,
      data: contact,
      contact,
      tasks: tasks.map((task) => ({
        ...task,
        _id: task.id,
        contactId: task.enquiryId,
        assignedTo: task.assignedTo.map((a) => ({
          _id: a.user.id,
          name: a.user.name,
          email: a.user.email,
        })),
      })),
      customerEnquiries: otherEnquiries.map((other) => ({
        _id: other.id,
        reference: other.reference,
        categoryLabel: ASSET_CATEGORY_LABELS[other.category],
        brand: other.brand,
        estimatedValue: other.estimatedValue !== null ? Number(other.estimatedValue) : null,
        stageName: other.pipelineEntries[0]?.stage.name ?? null,
        createdAt: other.createdAt,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Error retrieving enquiry:", error);
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    return NextResponse.json(
      { success: false, error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(request);

    let isAdmin = false;
    try {
      authorizeRoles(user, "admin");
      isAdmin = true;
    } catch {
      try {
        authorizeRoles(user, "team_member");
      } catch {
        return NextResponse.json(
          { error: "User is neither admin nor team member" },
          { status: 401 }
        );
      }
    }

    const { id } = await context.params;
    const body: UpdateEnquiryRequest = await request.json();

    const existing = await prisma.enquiry.findUnique({
      where: { id },
      include: { customer: true, tags: true, assignedTo: { select: { userId: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Enquiry not found" },
        { status: 404 }
      );
    }

    // A team member may only edit an enquiry assigned to them.
    if (!isAdmin && !existing.assignedTo.some((a) => a.userId === user.id)) {
      return NextResponse.json(
        { success: false, message: "Enquiry not found or unauthorized" },
        { status: 404 }
      );
    }

    const errors: string[] = [];
    if (body.name !== undefined && (!body.name.trim() || body.name.length > 200)) {
      errors.push("Name is required and must not exceed 200 characters");
    }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push("Valid email is required");
    }
    if (body.phone !== undefined && normalizeMobile(body.phone).length < 10) {
      errors.push("Valid 10-digit mobile number is required");
    }
    if (body.notes !== undefined && body.notes !== null && body.notes.length > 5000) {
      errors.push("Notes must not exceed 5000 characters");
    }
    if (
      body.tags !== undefined &&
      (!Array.isArray(body.tags) || body.tags.some((tag) => !tag?.name))
    ) {
      errors.push("Tags must be an array of objects with a name property");
    }
    if (errors.length) {
      return NextResponse.json(
        { success: false, message: "Invalid input data", errors },
        { status: 400 }
      );
    }

    const oldTags = existing.tags.map((tag) => tag.name);
    const newTags = body.tags?.map((tag) => tag.name);
    const addedTags = newTags?.filter((tag) => !oldTags.includes(tag)) ?? [];
    const removedTags = newTags ? oldTags.filter((tag) => !newTags.includes(tag)) : [];

    const valuationRecorded =
      body.estimatedValue !== undefined &&
      optionalNumber(body.estimatedValue) !== null &&
      Number(existing.estimatedValue ?? NaN) !== optionalNumber(body.estimatedValue);

    const updated = await prisma.$transaction(async (tx) => {
      if (body.phone !== undefined || body.name !== undefined || body.email !== undefined) {
        const mobile = body.phone !== undefined ? normalizeMobile(body.phone) : undefined;

        // The mobile is the customer key, so an edit that collides with
        // another customer is rejected rather than silently merging two
        // people's enquiry histories.
        if (mobile && mobile !== existing.customer.mobile) {
          const clash = await tx.customer.findUnique({ where: { mobile } });
          if (clash) {
            throw new Error("DUPLICATE_MOBILE");
          }
        }

        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            ...(body.name !== undefined && { name: body.name.trim() }),
            ...(body.email !== undefined && { email: body.email || null }),
            ...(mobile && { mobile }),
            ...(body.city !== undefined && { city: body.city || null }),
            ...(body.preferredContact !== undefined && {
              preferredContact: parsePreferredContact(body.preferredContact),
            }),
          },
        });
      }

      const source =
        body.source !== undefined && body.source
          ? await tx.source.upsert({
              where: { title: body.source },
              update: {},
              create: { title: body.source },
            })
          : null;

      const data: Prisma.EnquiryUpdateInput = {
        ...(body.jewelleryType !== undefined && {
          jewelleryType: parseJewelleryType(body.jewelleryType),
        }),
        ...(body.brand !== undefined && { brand: body.brand || null }),
        ...(body.metalWeight !== undefined && {
          metalWeightG: optionalNumber(body.metalWeight),
        }),
        ...(body.carat !== undefined && { caratWeight: optionalNumber(body.carat) }),
        ...(body.shapeCut !== undefined && { shapeCut: parseShapeCut(body.shapeCut) }),
        ...(body.condition !== undefined && { condition: parseCondition(body.condition) }),
        ...(body.certificateAvailable !== undefined && {
          certificateAvailable: parseYesNo(body.certificateAvailable),
        }),
        ...(body.certificateLab !== undefined && {
          certificateLab: parseCertificateLab(body.certificateLab),
        }),
        ...(body.purchaseYear !== undefined && {
          purchaseYear: optionalNumber(body.purchaseYear),
        }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.estimatedValue !== undefined && {
          estimatedValue: optionalNumber(body.estimatedValue),
        }),
        ...(body.offeredAmount !== undefined && {
          offeredAmount: optionalNumber(body.offeredAmount),
        }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(source && { source: { connect: { id: source.id } } }),
        ...(valuationRecorded && {
          valuedAt: new Date(),
          valuedBy: { connect: { id: user.id } },
        }),
      };

      if (newTags) {
        data.tags = {
          deleteMany: {},
          create: newTags.map((name) => ({ name, userId: user.id })),
        };
      }

      const enquiry = await tx.enquiry.update({
        where: { id },
        data,
        include: ENQUIRY_INCLUDE,
      });

      const activities: Prisma.EnquiryActivityCreateManyInput[] = [
        {
          enquiryId: id,
          userId: user.id,
          action: "ENQUIRY_UPDATED",
          details: { updatedFields: Object.keys(body) },
        },
        ...addedTags.map((tag) => ({
          enquiryId: id,
          userId: user.id,
          action: "TAG_ADDED" as const,
          details: { tag },
        })),
        ...removedTags.map((tag) => ({
          enquiryId: id,
          userId: user.id,
          action: "TAG_REMOVED" as const,
          details: { tag },
        })),
      ];

      if (valuationRecorded) {
        activities.push({
          enquiryId: id,
          userId: user.id,
          action: "VALUATION_RECORDED",
          details: { estimatedValue: optionalNumber(body.estimatedValue) },
        });
      }

      await tx.enquiryActivity.createMany({ data: activities });

      return enquiry;
    });

    return NextResponse.json(
      { success: true, contact: serializeEnquiry(updated) },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "DUPLICATE_MOBILE") {
      return NextResponse.json(
        { success: false, message: "Mobile number already belongs to another customer" },
        { status: 400 }
      );
    }
    console.error("Error updating enquiry:", error);
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    return NextResponse.json(
      { success: false, error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(request);
    authorizeRoles(user, "admin");

    const { id } = await context.params;
    await prisma.enquiry.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error deleting enquiry:", error);
    return NextResponse.json(
      { success: false, error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
