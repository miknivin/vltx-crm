import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

/// The stages a valuation enquiry moves through, from the form landing in the
/// CRM to the asset being bought. `isSuccess` marks the one stage that counts
/// as converted for reporting.
const DEFAULT_STAGES = [
  { name: "New Enquiry", order: 1, probability: 10, isSuccess: false },
  { name: "Contacted", order: 2, probability: 25, isSuccess: false },
  { name: "Valuation In Progress", order: 3, probability: 45, isSuccess: false },
  { name: "Offer Made", order: 4, probability: 70, isSuccess: false },
  { name: "Negotiation", order: 5, probability: 85, isSuccess: false },
  { name: "Purchased", order: 6, probability: 100, isSuccess: true },
  { name: "Not Proceeding", order: 7, probability: 0, isSuccess: false },
];

const DEFAULT_SOURCES = [
  "Website Valuation Form",
  "Walk-in",
  "Referral",
  "Phone Enquiry",
  "WhatsApp",
  "Instagram",
  "Manual Entry",
];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@vltx.in").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is required — refusing to seed an admin account with a default password."
    );
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: process.env.SEED_ADMIN_NAME ?? "VLTX Admin",
      email: adminEmail,
      phone: process.env.SEED_ADMIN_PHONE ?? "9633226916",
      password: await bcrypt.hash(adminPassword, 10),
      role: "admin",
      signupMethod: "EmailPassword",
    },
  });
  console.log(`admin: ${admin.email} (${admin.id})`);

  const pipeline = await prisma.pipeline.upsert({
    where: { name: "Valuation Pipeline" },
    update: {},
    create: {
      name: "Valuation Pipeline",
      notes: "Default pipeline for enquiries from the VLTX website valuation form.",
      userId: admin.id,
    },
  });
  console.log(`pipeline: ${pipeline.name} (${pipeline.id})`);

  for (const stage of DEFAULT_STAGES) {
    await prisma.stage.upsert({
      where: { pipelineId_order: { pipelineId: pipeline.id, order: stage.order } },
      update: { name: stage.name, probability: stage.probability, isSuccess: stage.isSuccess },
      create: { ...stage, pipelineId: pipeline.id },
    });
  }
  console.log(`stages: ${DEFAULT_STAGES.length}`);

  for (const title of DEFAULT_SOURCES) {
    await prisma.source.upsert({ where: { title }, update: {}, create: { title } });
  }
  console.log(`sources: ${DEFAULT_SOURCES.length}`);

  const newEnquiryStage = await prisma.stage.findFirst({
    where: { pipelineId: pipeline.id, order: 1 },
    select: { id: true },
  });

  console.log("\nAdd these to .env.local / Vercel env:");
  console.log(`DEFAULT_PIPELINE=${pipeline.id}`);
  console.log(`NEXT_PUBLIC_DEFAULT_PIPELINE=${pipeline.id}`);
  console.log(`DEFAULT_STAGE=${newEnquiryStage?.id}`);
  console.log(`NEXT_PUBLIC_DEFAULT_STAGE=${newEnquiryStage?.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
