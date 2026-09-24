import prisma from "@/app/lib/db/prisma";

/// Stage ids that count as "converted" — the enquiry was bought. Used by the
/// filters and the AI aggregations to separate won enquiries from open ones.
export async function getSuccessStageIds(): Promise<string[]> {
  const stages = await prisma.stage.findMany({
    where: { isSuccess: true },
    select: { id: true },
  });
  return stages.map((stage) => stage.id);
}
