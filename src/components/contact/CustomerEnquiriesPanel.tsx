import Link from "next/link";
import type { CustomerEnquirySummary } from "@/app/redux/api/contactApi";

interface CustomerEnquiriesPanelProps {
  customerName: string;
  enquiries: CustomerEnquirySummary[];
  /// Defaults to "Other Enquiries from {name} (N)", the copy that makes sense
  /// from an enquiry's own detail page. The customer detail page passes its
  /// own heading, since every enquiry listed there is "other" to nothing.
  title?: string;
  /// Shown instead of rendering nothing when the list is empty. The
  /// enquiry-detail usage renders nothing here, since a customer with only
  /// one enquiry never needs to be told that.
  emptyMessage?: string;
}

const formatValue = (value: number | null) =>
  value === null ? "Not yet valued" : `₹${value.toLocaleString("en-IN")}`;

/// A seller isn't limited to one asset — this surfaces the customer's other
/// enquiries so a team member working the current one can see their full
/// history instead of a single, seemingly isolated submission. Renders
/// nothing when this is the only enquiry on file for them, unless the caller
/// supplies its own `emptyMessage`.
export default function CustomerEnquiriesPanel({
  customerName,
  enquiries,
  title,
  emptyMessage,
}: CustomerEnquiriesPanelProps) {
  if (enquiries.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
        {title ?? `Other Enquiries from ${customerName} (${enquiries.length})`}
      </h2>
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {enquiries.map((enquiry) => (
          <Link
            key={enquiry._id}
            href={`/enquiries/${enquiry._id}`}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:opacity-80"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                #{enquiry.reference} · {enquiry.categoryLabel}
                {enquiry.brand ? ` · ${enquiry.brand}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {new Date(enquiry.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {enquiry.stageName ? ` · ${enquiry.stageName}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatValue(enquiry.estimatedValue)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
