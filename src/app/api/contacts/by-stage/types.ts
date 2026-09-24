import type { EnquiryFilterBody } from "@/app/lib/enquiry/buildFilterWhere";

export interface ByStageAssignedToFilter {
  _id: string;
  isNot: boolean;
}

export interface ParsedByStageParams {
  pipelineId: string;
  stageId: string;
  keyword?: string;
  page: number;
  limit: number;
  /// The valuation filters from the drawer, shared with the enquiry list so
  /// the same saved filter means the same thing in both places.
  filter: EnquiryFilterBody;
}

export class ByStageApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
