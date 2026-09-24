import prisma from "@/app/lib/db/prisma";

export interface BatchUpdateItem {
  contactId: string;
  pipelineId: string;
  stageId: string;
  order: number;
}

export interface ExistingEntry {
  id: string;
  enquiryId: string;
  pipelineId: string;
  stageId: string;
  stageName: string;
}

interface ValidateBatchUpdatesResult {
  /// Current board position per enquiry, keyed `enquiryId:pipelineId`. Used
  /// to name the stage a card came from when logging the move, and to reject
  /// a move for an enquiry that is not on this pipeline.
  entries: Map<string, ExistingEntry>;
  stageNames: Map<string, string>;
  pipelineNames: Map<string, string>;
}

export const entryKey = (enquiryId: string, pipelineId: string) =>
  `${enquiryId}:${pipelineId}`;

export async function validateBatchUpdates(
  updates: BatchUpdateItem[]
): Promise<ValidateBatchUpdatesResult> {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("Updates must be a non-empty array");
  }

  const enquiryIds = new Set<string>();
  const stageIds = new Set<string>();
  const pipelineIds = new Set<string>();

  for (const { contactId, pipelineId, stageId, order } of updates) {
    if (!contactId || !pipelineId || !stageId) {
      throw new Error(
        `Invalid contactId, pipelineId, or stageId in update for enquiry ${contactId}`
      );
    }
    if (typeof order !== "number" || order < 0) {
      throw new Error(
        `Order must be a non-negative number in update for enquiry ${contactId}`
      );
    }
    enquiryIds.add(contactId);
    stageIds.add(stageId);
    pipelineIds.add(pipelineId);
  }

  const [existing, stages, pipelines] = await Promise.all([
    prisma.pipelineEntry.findMany({
      where: {
        enquiryId: { in: [...enquiryIds] },
        pipelineId: { in: [...pipelineIds] },
      },
      select: {
        id: true,
        enquiryId: true,
        pipelineId: true,
        stageId: true,
        stage: { select: { name: true } },
      },
    }),
    prisma.stage.findMany({
      where: { id: { in: [...stageIds] } },
      select: { id: true, name: true, pipelineId: true },
    }),
    prisma.pipeline.findMany({
      where: { id: { in: [...pipelineIds] } },
      select: { id: true, name: true },
    }),
  ]);

  const entries = new Map<string, ExistingEntry>(
    existing.map((entry) => [
      entryKey(entry.enquiryId, entry.pipelineId),
      {
        id: entry.id,
        enquiryId: entry.enquiryId,
        pipelineId: entry.pipelineId,
        stageId: entry.stageId,
        stageName: entry.stage.name,
      },
    ])
  );

  const stageMap = new Map(stages.map((stage) => [stage.id, stage]));

  for (const { contactId, pipelineId, stageId } of updates) {
    if (!entries.has(entryKey(contactId, pipelineId))) {
      throw new Error(`Enquiry ${contactId} is not on pipeline ${pipelineId}`);
    }
    const stage = stageMap.get(stageId);
    if (!stage || stage.pipelineId !== pipelineId) {
      throw new Error(`Stage ${stageId} does not belong to pipeline ${pipelineId}`);
    }
  }

  return {
    entries,
    stageNames: new Map(stages.map((stage) => [stage.id, stage.name])),
    pipelineNames: new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name])),
  };
}
