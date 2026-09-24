"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useGetCustomersQuery, CustomerListItem } from "@/app/redux/api/customerApi";
import ShortSpinnerPrimary from "../ui/loaders/ShortSpinnerPrimary";
import BasicPagination from "../ui/pagination/BasicPagination";
import Select from "../form/Select";
import { ChevronDownIcon } from "@/icons";
import EditIcon from "../ui/flowbiteIcons/EditIcon";

const CustomerTableOne: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [params, setParams] = useState<{ page: number; limit: number; keyword: string }>({
    page: 1,
    limit: 10,
    keyword: "",
  });

  useEffect(() => {
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const keyword = searchParams.get("keyword") || "";

    const validPage = isNaN(page) || page < 1 ? 1 : page;
    const validLimit = isNaN(limit) || !["10", "15", "25", "50"].includes(limit.toString()) ? 10 : limit;

    setParams({ page: validPage, limit: validLimit, keyword });
  }, [searchParams]);

  useEffect(() => {
    const query = new URLSearchParams();
    query.set("page", params.page.toString());
    query.set("limit", params.limit.toString());
    if (params.keyword) query.set("keyword", params.keyword);
    router.push(`?${query.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const { data, error, isLoading, isFetching } = useGetCustomersQuery(params);

  const options = [
    { value: "10", label: "10" },
    { value: "15", label: "15" },
    { value: "25", label: "25" },
    { value: "50", label: "50" },
  ];

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParams((prev) => ({ ...prev, keyword: e.target.value, page: 1 }));
  };

  const handleLimitChange = (value: string) => {
    setParams((prev) => ({ ...prev, limit: parseInt(value), page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setParams((prev) => ({ ...prev, page }));
  };

  const handlePrevPage = () => {
    if (params.page > 1) setParams((prev) => ({ ...prev, page: prev.page - 1 }));
  };

  const handleNextPage = () => {
    if (data?.pagination.totalPages && params.page < data.pagination.totalPages) {
      setParams((prev) => ({ ...prev, page: prev.page + 1 }));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getErrorMessage = (error: any): string => {
    if (!error) return "Unknown error";
    if ("status" in error) {
      return `Error ${error.status}: ${JSON.stringify(error.data) || "Unknown error"}`;
    }
    return error.message || "Unknown error";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="mb-2 px-5 py-3 flex gap-3 justify-between">
        <input
          type="text"
          placeholder="Search contacts..."
          value={params.keyword}
          onChange={handleSearch}
          className="w-full max-w-xl rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <div className="relative flex gap-3">
          <Select
            options={options}
            value={params.limit.toString()}
            defaultValue="10"
            placeholder="Items per page"
            onChange={handleLimitChange}
            className="dark:bg-dark-900"
          />
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
            <ChevronDownIcon />
          </span>
        </div>
      </div>
      <div className="relative overflow-x-auto max-h-[calc(110vh-200px)]">
        <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-3 py-2">Contact</th>
              <th scope="col" className="px-3 py-2">Phone number</th>
              <th scope="col" className="px-3 py-2">City</th>
              <th scope="col" className="px-3 py-2">Enquiries</th>
              <th scope="col" className="px-3 py-2">Last enquiry</th>
              <th scope="col" className="px-3 py-2">Customer since</th>
              <th scope="col" className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading || isFetching) && (
              <tr className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200">
                <td colSpan={7} className="px-5 py-4 text-center">
                  <div className="w-full flex justify-center">
                    <ShortSpinnerPrimary />
                  </div>
                </td>
              </tr>
            )}
            {error && (
              <tr className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200">
                <td colSpan={7} className="px-5 py-4 text-center text-red-500">
                  {getErrorMessage(error)}
                </td>
              </tr>
            )}
            {!isLoading && !error && data?.customers.length === 0 && (
              <tr className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200">
                <td colSpan={7} className="px-5 py-4 text-center">
                  No contacts found
                </td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              data?.customers?.map((customer: CustomerListItem) => (
                <tr
                  key={customer._id}
                  className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200"
                >
                  <th scope="row" className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    <div>
                      <span className="block font-medium text-gray-800 text-sm dark:text-white/90">
                        {customer.name}
                      </span>
                      <span className="block text-gray-500 text-xs dark:text-gray-400">
                        {customer.email ?? "—"}
                      </span>
                    </div>
                  </th>
                  <td className="px-3 py-2">{customer.mobile}</td>
                  <td className="px-3 py-2">{customer.city ?? "—"}</td>
                  <td className="px-3 py-2">{customer.enquiryCount}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {customer.lastEnquiryAt
                      ? new Date(customer.lastEnquiryAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(customer.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/contacts/${customer._id}`}
                      className="text-white flex justify-center items-center w-fit bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-2.5 py-2.5 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
                      title="View Contact"
                    >
                      <EditIcon />
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {data?.pagination && (
        <div className="px-5 py-3 text-gray-800 dark:text-white/90 flex justify-between items-center">
          <div className="text-sm">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} contacts)
          </div>
          <BasicPagination
            currentPage={params.page}
            totalPages={data.pagination.totalPages}
            onPageChange={handlePageChange}
            onPrev={handlePrevPage}
            onNext={handleNextPage}
          />
        </div>
      )}
    </div>
  );
};

export default CustomerTableOne;
