import { Metadata } from "next";
import React from "react";
import CustomerByIdHeader from "@/components/page-components/CustomerByIdHeader";
import CustomerDetailWrapper from "@/components/customer/CustomerDetailWrapper";
import { getAppMetaTitle } from "@/app/lib/utils/metadata";

export const metadata: Metadata = {
  title: getAppMetaTitle("Contact Details | VLTX CRM"),
  description: "",
};

export default async function ContactDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div>
      <CustomerByIdHeader customerId={id} />
      <CustomerDetailWrapper customerId={id} />
    </div>
  );
}
