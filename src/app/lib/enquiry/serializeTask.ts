import type { Prisma } from "@prisma/client";
import { ASSET_CATEGORY_LABELS } from "./constants";

export const TASK_INCLUDE = {
  enquiry: {
    select: {
      id: true,
      reference: true,
      category: true,
      customer: { select: { name: true } },
    },
  },
  assignedTo: { include: { user: { select: { id: true, name: true, email: true } } } },
  owner: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

/// Shapes a task the way the task board and the enquiry detail page read it:
/// `_id`, and `contactId` as the populated `{ _id, name }` object those
/// components destructure.
export function serializeTask(task: TaskWithRelations) {
  return {
    _id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    contactId: task.enquiry
      ? {
          _id: task.enquiry.id,
          reference: task.enquiry.reference,
          name: `${task.enquiry.customer.name} · ${ASSET_CATEGORY_LABELS[task.enquiry.category]}`,
        }
      : null,
    assignedTo: task.assignedTo.map((assignment) => ({
      _id: assignment.user.id,
      name: assignment.user.name,
      email: assignment.user.email,
    })),
    owner: task.owner
      ? { _id: task.owner.id, name: task.owner.name, email: task.owner.email }
      : null,
    createdBy: task.createdBy
      ? { _id: task.createdBy.id, name: task.createdBy.name, email: task.createdBy.email }
      : null,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
