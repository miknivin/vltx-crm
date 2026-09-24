import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";
import React from "react";
import { isValidId } from "@/app/types/enquiry";
import { notFound } from "next/navigation";
import MobilePipelineBody from "@/components/form/pipeline-mobile";
import { getAppMetaTitle } from "@/app/lib/utils/metadata";

export const metadata: Metadata = {
  title: getAppMetaTitle("LSH-CRM"),
  description: "View and manage your CRM pipelines",
};

export default async function Pipelines({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; 

  if (!isValidId(id)) {
    notFound();
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Pipelines" />
      <MobilePipelineBody pipelineId={id} />
    </div>
  );
}
