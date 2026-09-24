"use client";
import Link from "next/link";
import { useGetCustomerByIdQuery } from "@/app/redux/api/customerApi";

interface CustomerByIdHeaderProps {
  customerId: string;
}

export default function CustomerByIdHeader({ customerId }: CustomerByIdHeaderProps) {
  // Shares the cache with CustomerDetailWrapper's own fetch of the same id.
  const { data } = useGetCustomerByIdQuery(customerId);

  return (
    <div className="flex justify-between w-full px-6 flex-row-reverse">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 text-start">
        {data?.data?.name ?? "Contact"}
      </h3>
      <Link
        href="/contacts"
        className="text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
        aria-label="Go back to contacts"
      >
        Go Back
      </Link>
    </div>
  );
}
