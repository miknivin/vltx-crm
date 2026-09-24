import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import EnquiriesHeader from "@/components/page-components/EnquiriesHeader";
import ContactTableOne from "@/components/tables/ContactTableOne";

import { Metadata } from "next";
import React from "react";
import { getAppMetaTitle } from "@/app/lib/utils/metadata";

export const metadata: Metadata = {
  title: getAppMetaTitle("Enquiries | VLTX CRM"),
  description:
    "",
};

export default function Enquiries() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Enquiries"/>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <EnquiriesHeader/>
        <div className="space-y-6">
          <ContactTableOne/>
        </div>
      </div>
    </div>
  );
}
