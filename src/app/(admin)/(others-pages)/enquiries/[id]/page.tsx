import { Metadata } from "next";
import React from "react";
import EnquiryByIdHeader from "@/components/page-components/EnquiryByIdHeader";
import EnquiryByIdWrapper from "@/components/enquiry/EnquiryByIdWrapper";
import { getAppMetaTitle } from "@/app/lib/utils/metadata";

export const metadata: Metadata = {
  title: getAppMetaTitle("Enquiry Details | VLTX CRM"),
  description: "",
};

export default async function EnquiryDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Extract id from params

  return (
    <div>
      <EnquiryByIdHeader enquiryId={id} />
      <EnquiryByIdWrapper enquiryId={id} />
    </div>
  );
}
