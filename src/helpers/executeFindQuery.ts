import EnquiryFilterBuilder from "@/app/classes/EnquiryFilterBuilder";
import prisma from "@/app/lib/db/prisma";
import { getSuccessStageIds } from "@/app/lib/utils/successStages";
import { ENQUIRY_INCLUDE, serializeEnquiry } from "@/app/lib/enquiry/serialize";
import { findMultiAssigneeEnquiryIds } from "@/app/lib/enquiry/assigneeCounts";
import { executeFilterActions } from "@/helpers/executeFilterActions";

interface FindStep {
  filterActions?: { method: string; args?: unknown[] }[];
  sort?: Record<string, number> | null;
  limit?: number | null;
}

/// Columns the model may sort by, mapped to a Prisma `orderBy`. Sorting is
/// not part of the filter allowlist, so it gets its own small map rather than
/// passing an arbitrary key through to the database.
const SORTABLE: Record<string, (direction: "asc" | "desc") => object> = {
  createdAt: (direction) => ({ createdAt: direction }),
  updatedAt: (direction) => ({ updatedAt: direction }),
  valuedAt: (direction) => ({ valuedAt: direction }),
  estimatedValue: (direction) => ({ estimatedValue: direction }),
  offeredAmount: (direction) => ({ offeredAmount: direction }),
  caratWeight: (direction) => ({ caratWeight: direction }),
  metalWeightG: (direction) => ({ metalWeightG: direction }),
  probability: (direction) => ({ probability: direction }),
  purchaseYear: (direction) => ({ purchaseYear: direction }),
  reference: (direction) => ({ reference: direction }),
  name: (direction) => ({ customer: { name: direction } }),
};

/**
 * Runs a single planned "find" step.
 *
 * `scopeUserId` is applied before any planned action, so no combination of
 * filters a model produces can widen a team member's view beyond the
 * enquiries assigned to them.
 */
export async function executeFindQuery(
  step: FindStep,
  scopeUserId: string | null,
  maxRows: number
) {
  const builder = EnquiryFilterBuilder.create();

  if (scopeUserId) builder.assignedTo(scopeUserId);

  // Populated before any planned isConverted/notConverted call can run.
  builder.setSuccessStageIds(await getSuccessStageIds());

  const actions = step.filterActions ?? [];

  // `hasMultipleAssignees` has no `where` form — the ids are resolved first
  // and narrowed with `idIn`, so it is handled before the generic dispatch.
  const remaining = [];
  for (const action of actions) {
    if (action.method === "hasMultipleAssignees") {
      builder.idIn(await findMultiAssigneeEnquiryIds());
    } else {
      remaining.push(action);
    }
  }

  executeFilterActions(builder, remaining);

  const orderBy = (() => {
    const [key, direction] = Object.entries(step.sort ?? {})[0] ?? [];
    if (!key || !SORTABLE[key]) return { createdAt: "desc" as const };
    return SORTABLE[key](Number(direction) >= 0 ? "asc" : "desc");
  })();

  const enquiries = await prisma.enquiry.findMany({
    where: builder.build(),
    include: ENQUIRY_INCLUDE,
    orderBy,
    take: Math.min(step.limit ?? maxRows, maxRows),
  });

  return enquiries.map(serializeEnquiry);
}
