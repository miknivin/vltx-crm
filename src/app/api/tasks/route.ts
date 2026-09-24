import { NextRequest, NextResponse } from "next/server";
import type { Prisma, TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";
import { serializeTask, TASK_INCLUDE } from "@/app/lib/enquiry/serializeTask";

const allowedPriorities: TaskPriority[] = ["low", "medium", "high"];
const allowedStatuses: TaskStatus[] = ["open", "in_progress", "done"];
const allowedTypes: TaskType[] = ["contact_linked", "custom"];

const parseAssignedTo = (value: unknown): string[] => {
  if (value === undefined || value === null || value === "") return [];
  const ids = Array.isArray(value) ? value : [value];
  return [...new Set(ids.map((id) => String(id)).filter(Boolean))];
};

const parseDueTime = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const dueTime = String(value);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) {
    throw new Error("dueTime must be in HH:mm format");
  }
  return dueTime;
};

export async function POST(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const body = await req.json();
    // `contact_linked` is kept as the wire value the task form already sends;
    // what it links to is now an enquiry.
    const type = (body.type || (body.contactId ? "contact_linked" : "custom")) as TaskType;

    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }
    if (body.priority && !allowedPriorities.includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    if (body.status && !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Only an admin can hand a task to someone else; a team member's task is
    // their own.
    const assignedTo = user.role === "admin" ? parseAssignedTo(body.assignedTo) : [];

    if (type === "contact_linked") {
      if (!body.contactId) {
        return NextResponse.json(
          { error: "contactId is required for a contact_linked task" },
          { status: 400 }
        );
      }
      const enquiry = await prisma.enquiry.findUnique({
        where: { id: body.contactId },
        select: { id: true },
      });
      if (!enquiry) {
        return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
      }
    }

    let dueTime: string | null = null;
    try {
      dueTime = parseDueTime(body.dueTime);
    } catch (error: unknown) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid dueTime" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        type,
        enquiryId: type === "contact_linked" ? body.contactId : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        dueTime,
        priority: body.priority || "medium",
        status: body.status || "open",
        ownerId: user.id,
        createdById: user.id,
        ...(assignedTo.length && {
          assignedTo: { create: assignedTo.map((userId) => ({ userId })) },
        }),
      },
      include: TASK_INCLUDE,
    });

    return NextResponse.json(
      { message: "Task created successfully", task: serializeTask(task) },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error creating task:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");
    const assignedTo = searchParams.get("assignedTo");
    const status = searchParams.get("status");
    const dueStartDate = searchParams.get("dueStartDate");
    const dueEndDate = searchParams.get("dueEndDate");
    const updatedStartDate = searchParams.get("updatedStartDate");
    const updatedEndDate = searchParams.get("updatedEndDate");
    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 12), 1), 100);

    const where: Prisma.TaskWhereInput = {};

    if (contactId) {
      where.enquiryId = contactId;
    } else if (user.role !== "admin") {
      // A non-admin's board shows what they own, created, or were given.
      where.OR = [
        { assignedTo: { some: { userId: user.id } } },
        { ownerId: user.id },
        { createdById: user.id },
      ];
    }

    if (assignedTo && user.role === "admin") {
      try {
        const selected = JSON.parse(assignedTo) as { _id: string; isNot?: boolean }[];
        const include = selected.filter((item) => !item.isNot).map((item) => item._id);
        const exclude = selected.filter((item) => item.isNot).map((item) => item._id);

        const clauses: Prisma.TaskWhereInput[] = [];
        if (include.length) {
          clauses.push({ assignedTo: { some: { userId: { in: include } } } });
        }
        if (exclude.length) {
          clauses.push({ assignedTo: { none: { userId: { in: exclude } } } });
        }
        if (clauses.length) where.AND = clauses;
      } catch {
        return NextResponse.json({ error: "Invalid assignedTo filter" }, { status: 400 });
      }
    }

    if (status) {
      if (!allowedStatuses.includes(status as TaskStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      where.status = status as TaskStatus;
    }

    const dayRange = (from: string | null, to: string | null) => {
      const range: Prisma.DateTimeFilter = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        range.gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      return Object.keys(range).length ? range : undefined;
    };

    const dueRange = dayRange(dueStartDate, dueEndDate);
    if (dueRange) where.dueDate = dueRange;
    const updatedRange = dayRange(updatedStartDate, updatedEndDate);
    if (updatedRange) where.updatedAt = updatedRange;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json(
      {
        tasks: tasks.map(serializeTask),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
