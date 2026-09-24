import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CustomerTableOne from "@/components/tables/CustomerTableOne";

import { Metadata } from "next";
import React from "react";
import { getAppMetaTitle } from "@/app/lib/utils/metadata";

export const metadata: Metadata = {
  title: getAppMetaTitle("Contacts | VLTX CRM"),
  description: "",
};

export default function Contacts() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Contacts" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="flex flex-col lg:flex-row gap-2 lg:gap-0 items-start justify-between lg:items-center w-full my-5">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 text-start">Contacts</h3>
        </div>
        <div className="space-y-6">
          <CustomerTableOne />
        </div>
      </div>
    </div>
  );
}
