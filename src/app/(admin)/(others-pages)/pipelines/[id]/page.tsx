import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PipelineBody from "@/components/pipeline";
import { Metadata } from "next";
import React from "react";
import { isValidId } from "@/app/types/enquiry";
import { notFound } from "next/navigation";
import { getAppMetaTitle } from "@/app/lib/utils/metadata";

export const metadata: Metadata = {
  title:
    process.env.NEXT_PUBLIC_TEST_MODE === "true"
      ? getAppMetaTitle("LSH-CRM")
      : process.env.NODE_ENV === 'development'
        ? 'connect-e CRM'
        : 'LSH-CRM',
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
      <PipelineBody pipelineId={id} />
    </div>
  );
}
