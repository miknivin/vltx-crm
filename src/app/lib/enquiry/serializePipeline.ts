import type { Pipeline, Stage, User } from "@prisma/client";

/// The pipeline/stage shapes the board and the pipeline forms read. Keyed on
/// `_id` and `pipeline_id` to match what those components already expect.

export function serializeStage(stage: Stage) {
  return {
    _id: stage.id,
    pipeline_id: stage.pipelineId,
    name: stage.name,
    order: stage.order,
    probability: stage.probability,
    isSuccess: stage.isSuccess,
    created_at: stage.createdAt,
    updated_at: stage.updatedAt,
  };
}

type PipelineWithOwner = Pipeline & {
  user?: Pick<User, "id" | "name" | "email"> | null;
  stages?: Stage[];
};

export function serializePipeline(pipeline: PipelineWithOwner) {
  return {
    _id: pipeline.id,
    name: pipeline.name,
    notes: pipeline.notes,
    user: pipeline.user
      ? { _id: pipeline.user.id, name: pipeline.user.name, email: pipeline.user.email }
      : null,
    created_at: pipeline.createdAt,
    updated_at: pipeline.updatedAt,
    ...(pipeline.stages && {
      stages: [...pipeline.stages]
        .sort((a, b) => a.order - b.order)
        .map(serializeStage),
    }),
  };
}
