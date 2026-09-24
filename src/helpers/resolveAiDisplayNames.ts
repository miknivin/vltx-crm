import prisma from "@/app/lib/db/prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isIdString = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

interface Row {
  pipelinesActive?: { pipeline_id?: string; stage_id?: string; order?: number }[];
  [key: string]: unknown;
}

/**
 * Turns the ids left in step OUTPUT rows into names.
 *
 * Ids are the right currency between the backend and the database, so queries
 * keep using them untouched; anything a person reads must speak in names, so
 * this runs at the response boundary. Group-by rows already carry their own
 * `label` from the aggregation builder, which leaves only `pipelinesActive`
 * inside record rows to reshape from `{pipeline_id, stage_id, order}` to
 * `{pipeline, stage, order}`.
 */
export async function resolveDisplayNames(rows: Row[]): Promise<Row[]> {
  if (rows.length === 0) return rows;

  const stageIds = new Set<string>();
  const pipelineIds = new Set<string>();

  for (const row of rows) {
    for (const entry of row.pipelinesActive ?? []) {
      if (isIdString(entry?.stage_id)) stageIds.add(entry.stage_id);
      if (isIdString(entry?.pipeline_id)) pipelineIds.add(entry.pipeline_id);
    }
  }

  if (stageIds.size === 0 && pipelineIds.size === 0) return rows;

  const [stages, pipelines] = await Promise.all([
    prisma.stage.findMany({
      where: { id: { in: [...stageIds] } },
      select: { id: true, name: true },
    }),
    prisma.pipeline.findMany({
      where: { id: { in: [...pipelineIds] } },
      select: { id: true, name: true },
    }),
  ]);

  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
  const pipelineNames = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name]));

  return rows.map((row) => {
    if (!row.pipelinesActive?.length) return row;
    return {
      ...row,
      pipelinesActive: row.pipelinesActive.map((entry) => ({
        pipeline: pipelineNames.get(entry?.pipeline_id ?? "") ?? "Unknown",
        stage: stageNames.get(entry?.stage_id ?? "") ?? "Unknown",
        order: entry?.order,
      })),
    };
  });
}
