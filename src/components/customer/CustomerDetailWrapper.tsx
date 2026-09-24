"use client";
import React from "react";
import { useSelector } from "react-redux";
import { useGetCustomerByIdQuery } from "@/app/redux/api/customerApi";
import { RootState } from "@/app/redux/rootReducer";
import ShortSpinnerPrimary from "@/components/ui/loaders/ShortSpinnerPrimary";
import CustomerContactCard from "./CustomerContactCard";
import CustomerTasksPanel from "./CustomerTasksPanel";
import CustomerEnquiriesPanel from "@/components/contact/CustomerEnquiriesPanel";

interface CustomerDetailWrapperProps {
  customerId: string;
}

export default function CustomerDetailWrapper({ customerId }: CustomerDetailWrapperProps) {
  const { data, error, isLoading } = useGetCustomerByIdQuery(customerId);
  const userRole = useSelector((state: RootState) => state.user.user?.role);
  const isAdmin = userRole === "admin";

  if (isLoading) return <div className="flex justify-center"><ShortSpinnerPrimary /></div>;
  if (error || !data?.success) return <div>Error loading contact</div>;

  const { data: customer, enquiries, tasks } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <CustomerContactCard customer={customer} isAdmin={isAdmin} />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <CustomerTasksPanel tasks={tasks} />
        </div>
      </div>
      <CustomerEnquiriesPanel
        customerName={customer.name}
        enquiries={enquiries}
        title={`Enquiries from ${customer.name} (${enquiries.length})`}
        emptyMessage="No enquiries submitted yet."
      />
    </div>
  );
}
