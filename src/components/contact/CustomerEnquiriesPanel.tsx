import Link from "next/link";
import type { CustomerEnquirySummary } from "@/app/redux/api/contactApi";

interface CustomerEnquiriesPanelProps {
  customerName: string;
  enquiries: CustomerEnquirySummary[];
}

const formatValue = (value: number | null) =>
  value === null ? "Not yet valued" : `₹${value.toLocaleString("en-IN")}`;

/// A seller isn't limited to one asset — this surfaces the customer's other
/// enquiries so a team member working the current one can see their full
/// history instead of a single, seemingly isolated submission. Renders
/// nothing when this is the only enquiry on file for them.
export default function CustomerEnquiriesPanel({
  customerName,
  enquiries,
}: CustomerEnquiriesPanelProps) {
  if (enquiries.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
        Other Enquiries from {customerName} ({enquiries.length})
      </h2>
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {enquiries.map((enquiry) => (
          <Link
            key={enquiry._id}
            href={`/contacts/${enquiry._id}`}
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
