import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";
import { ASSET_CATEGORY_LABELS, PREFERRED_CONTACT_LABELS, parsePreferredContact } from "@/app/lib/enquiry/constants";
import { normalizeMobile } from "@/app/lib/enquiry/createEnquiry";
import { encodeReference } from "@/app/lib/enquiry/referenceCode";

interface UpdateCustomerRequest {
  name?: string;
  email?: string | null;
  mobile?: string;
  city?: string | null;
  preferredContact?: string | null;
  notes?: string | null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(request);
    authorizeRoles(user, "admin", "team_member");

    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
    }

    // A team member may only view a contact they have an assigned enquiry
    // with — same scoping rule as the enquiry detail endpoint, applied one
    // level up.
    if (user.role !== "admin") {
      const owns = await prisma.enquiry.findFirst({
        where: { customerId: id, assignedTo: { some: { userId: user.id } } },
        select: { id: true },
      });
      if (!owns) {
        return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
      }
    }

    const enquiries = await prisma.enquiry.findMany({
      where: { customerId: id },
      select: {
        id: true,
        reference: true,
        category: true,
        brand: true,
        estimatedValue: true,
        createdAt: true,
        pipelineEntries: { take: 1, select: { stage: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const tasks = await prisma.task.findMany({
      where: { enquiry: { customerId: id } },
      include: {
        assignedTo: { include: { user: { select: { id: true, name: true, email: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        enquiry: { select: { id: true, reference: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        city: customer.city,
        preferredContact: customer.preferredContact,
        preferredContactLabel: customer.preferredContact
          ? PREFERRED_CONTACT_LABELS[customer.preferredContact]
          : null,
        notes: customer.notes,
        createdAt: customer.createdAt,
      },
      enquiries: enquiries.map((enquiry) => ({
        _id: enquiry.id,
        reference: encodeReference(enquiry.reference),
        categoryLabel: ASSET_CATEGORY_LABELS[enquiry.category],
        brand: enquiry.brand,
        estimatedValue: enquiry.estimatedValue !== null ? Number(enquiry.estimatedValue) : null,
        stageName: enquiry.pipelineEntries[0]?.stage.name ?? null,
        createdAt: enquiry.createdAt,
      })),
      tasks: tasks.map((task) => ({
        ...task,
        _id: task.id,
        contactId: task.enquiryId
          ? {
              _id: task.enquiryId,
              name: task.enquiry ? `Enquiry #${encodeReference(task.enquiry.reference)}` : undefined,
            }
          : null,
        assignedTo: task.assignedTo.map((a) => ({
          _id: a.user.id,
          name: a.user.name,
          email: a.user.email,
        })),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Error retrieving contact:", error);
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
    authorizeRoles(user, "admin");

    const { id } = await context.params;
    const body: UpdateCustomerRequest = await request.json();

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Contact not found" }, { status: 404 });
    }

    const errors: string[] = [];
    if (body.name !== undefined && (!body.name.trim() || body.name.length > 200)) {
      errors.push("Name is required and must not exceed 200 characters");
    }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push("Valid email is required");
    }
    if (body.mobile !== undefined && normalizeMobile(body.mobile).length < 10) {
      errors.push("Valid 10-digit mobile number is required");
    }
    if (body.notes !== undefined && body.notes !== null && body.notes.length > 5000) {
      errors.push("Notes must not exceed 5000 characters");
    }
    if (errors.length) {
      return NextResponse.json(
        { success: false, message: "Invalid input data", errors },
        { status: 400 }
      );
    }

    const mobile = body.mobile !== undefined ? normalizeMobile(body.mobile) : undefined;

    // The mobile is the unique customer key, so an edit that collides with
    // another customer is rejected rather than silently merging two people's
    // enquiry histories.
    if (mobile && mobile !== existing.mobile) {
      const clash = await prisma.customer.findUnique({ where: { mobile } });
      if (clash) {
        return NextResponse.json(
          { success: false, message: "Mobile number already belongs to another customer" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(mobile && { mobile }),
        ...(body.city !== undefined && { city: body.city || null }),
        ...(body.preferredContact !== undefined && {
          preferredContact: parsePreferredContact(body.preferredContact),
        }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: updated.id,
        name: updated.name,
        mobile: updated.mobile,
        email: updated.email,
        city: updated.city,
        preferredContact: updated.preferredContact,
        preferredContactLabel: updated.preferredContact
          ? PREFERRED_CONTACT_LABELS[updated.preferredContact]
          : null,
        notes: updated.notes,
        createdAt: updated.createdAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Error updating contact:", error);
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    return NextResponse.json(
      { success: false, error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
