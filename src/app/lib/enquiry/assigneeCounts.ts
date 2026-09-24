import prisma from "@/app/lib/db/prisma";

/// Enquiries with more than one assignee. A Prisma `where` has no count
/// predicate, so the ids are resolved here and fed to the filter builder via
/// `idIn`. Grouping on the junction table is cheap — it is indexed on
/// `enquiry_id` as the leading column of its primary key.
export async function findMultiAssigneeEnquiryIds(): Promise<string[]> {
  const grouped = await prisma.enquiryAssignment.groupBy({
    by: ["enquiryId"],
    _count: { userId: true },
    having: { userId: { _count: { gt: 1 } } },
  });
  return grouped.map((row) => row.enquiryId);
}
