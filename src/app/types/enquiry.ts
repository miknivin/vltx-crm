import type { SerializedEnquiry } from "@/app/lib/enquiry/serialize";

/// The enquiry record as the frontend receives it.
export type IEnquiry = SerializedEnquiry;

/// Kept under the old name so the components that already read this shape
/// keep compiling; a "contact" in the UI is a valuation enquiry.
export type IContact = SerializedEnquiry;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidId = (value: string | undefined | null): boolean =>
  typeof value === "string" && UUID_PATTERN.test(value);
