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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const { id } = await context.params;
    const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task: serializeTask(task) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const { id } = await context.params;
    const body = await req.json();

    const data: Prisma.TaskUpdateInput = {};
    let newAssignees: string[] | undefined;

    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.type !== undefined) {
      if (!allowedTypes.includes(body.type)) {
        return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
      }
      data.type = body.type;
    }
    if (body.contactId !== undefined) {
      data.enquiry = body.contactId
        ? { connect: { id: body.contactId } }
        : { disconnect: true };
    }
    if (body.assignedTo !== undefined) {
      if (user.role !== "admin") {
        return NextResponse.json(
          { error: "Only admins can update assigned users" },
          { status: 403 }
        );
      }
      newAssignees = parseAssignedTo(body.assignedTo);
    }
    if (body.dueDate !== undefined) {
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.dueTime !== undefined) {
      try {
        data.dueTime = parseDueTime(body.dueTime);
      } catch (error: unknown) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Invalid dueTime" },
          { status: 400 }
        );
      }
    }
    if (body.priority !== undefined) {
      if (!allowedPriorities.includes(body.priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
      data.priority = body.priority;
    }
    if (body.status !== undefined) {
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = body.status;
    }

    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Anyone assigned a task can tick it off; only an admin or its owner can
    // change what the task actually is.
    const touchedFields = Object.keys(data).concat(newAssignees ? ["assignedTo"] : []);
    const statusOnlyUpdate =
      touchedFields.length > 0 && touchedFields.every((field) => field === "status");
    const canManageTask = user.role === "admin" || existing.ownerId === user.id;

    if (!canManageTask && !statusOnlyUpdate) {
      return NextResponse.json(
        { error: "Only admins or the task owner can edit task details" },
        { status: 403 }
      );
    }

    const task = await prisma.$transaction(async (tx) => {
      if (newAssignees) {
        await tx.taskAssignment.deleteMany({ where: { taskId: id } });
        if (newAssignees.length) {
          await tx.taskAssignment.createMany({
            data: newAssignees.map((userId) => ({ taskId: id, userId })),
          });
        }
      }

      return tx.task.update({ where: { id }, data, include: TASK_INCLUDE });
    });

    return NextResponse.json(
      { message: "Task updated successfully", task: serializeTask(task) },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error updating task:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin", "team_member");

    const { id } = await context.params;
    const task = await prisma.task.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (user.role !== "admin" && task.ownerId !== user.id) {
      return NextResponse.json(
        { error: "Only admins or the task owner can delete a task" },
        { status: 403 }
      );
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const unauthorized = message.includes("login") || message.includes("Not allowed");
    if (!unauthorized) console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: unauthorized ? message : "Internal server error" },
      { status: unauthorized ? 401 : 500 }
    );
  }
}
