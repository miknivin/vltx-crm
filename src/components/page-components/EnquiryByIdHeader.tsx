"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useGetContactByIdQuery } from "@/app/redux/api/contactApi";

interface EnquiryByIdHeaderProps {
  enquiryId: string;
}

export default function EnquiryByIdHeader({ enquiryId }: EnquiryByIdHeaderProps) {
  const searchParams = useSearchParams();
  const fromPipeline = searchParams.get("fromPipeline");
  const [isMobile, setIsMobile] = useState(false);
  // Shares the cache with EnquiryByIdWrapper's own fetch of the same id — this
  // doesn't add a second network request, just reads the human-facing
  // reference number for the header instead of a truncated UUID.
  const { data } = useGetContactByIdQuery(enquiryId);

  // Detect mobile view based on window width
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // Tailwind's md breakpoint
    };

    // Initial check
    handleResize();

    // Add resize event listener
    window.addEventListener("resize", handleResize);

    // Cleanup on unmount
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Determine redirect path
  const defaultPipeline = process.env.NEXT_PUBLIC_DEFAULT_PIPELINE || "default-pipeline-id";
  const redirectPathname = fromPipeline === "true"
    ? isMobile
      ? `/pipelines/mobile/${defaultPipeline}`
      : `/pipelines/${defaultPipeline}`
    : "/enquiries";

  const currentQuery = Object.fromEntries(searchParams);
  const newQuery = { ...currentQuery };

  const reference = data?.data?.reference;

  return (
    <div className="flex justify-between w-full px-6 flex-row-reverse">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 text-start">
        {reference ? `Enquiry #${reference}` : `#${enquiryId.slice(-6)}`}
      </h3>
      <Link
         href={{
          pathname: redirectPathname,
          query: newQuery,
        }}
        className="text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
        aria-label={fromPipeline === "true" ? "Go back to pipeline" : "Go back to enquiries"}
      >
        Go Back
      </Link>
    </div>
  );
}
