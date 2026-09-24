import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/app/lib/db/prisma";
import {
  parseAssetCategory,
  parseCertificateLab,
  parseCondition,
  parseJewelleryType,
  parsePreferredContact,
  parseShapeCut,
  parseYesNo,
} from "./constants";
import { ENQUIRY_INCLUDE } from "./serialize";

type Tx = Prisma.TransactionClient | PrismaClient;

export class EnquiryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnquiryInputError";
  }
}

/// The valuation form's payload, in the labels the form itself uses. Both the
/// CRM's manual create and the website intake speak this shape, so there is
/// one place where form wording becomes database enums.
export interface EnquiryInput {
  // Person
  name: string;
  mobile: string;
  email?: string | null;
  city?: string | null;
  preferredContact?: string | null;

  // Asset
  category: string;
  jewelleryType?: string | null;
  brand?: string | null;
  metalWeight?: string | number | null;
  carat?: string | number | null;
  shapeCut?: string | null;
  condition?: string | null;
  certificateAvailable?: string | boolean | null;
  certificateLab?: string | null;
  purchaseYear?: string | number | null;
  description?: string | null;
  photos?: { url: string; key?: string | null }[];

  // CRM-side extras
  notes?: string | null;
  tags?: string[];
  sourceTitle?: string | null;
  stageId?: string | null;
  pipelineId?: string | null;
  assignToUserId?: string | null;
}

function optionalNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/// Digits only, so "+91 96332 26916" and "9633226916" resolve to the same
/// person rather than creating a second customer row.
export function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function resolveDefaultPlacement(tx: Tx, input: EnquiryInput) {
  const pipelineId = input.pipelineId || process.env.DEFAULT_PIPELINE;
  if (!pipelineId) {
    throw new EnquiryInputError(
      "No pipeline configured. Set DEFAULT_PIPELINE, or pass pipelineId."
    );
  }

  const pipeline = await tx.pipeline.findUnique({
    where: { id: pipelineId },
    select: { id: true, name: true },
  });
  if (!pipeline) throw new EnquiryInputError("Pipeline not found");

  const stageId = input.stageId || process.env.DEFAULT_STAGE;
  const stage = stageId
    ? await tx.stage.findFirst({
        where: { id: stageId, pipelineId: pipeline.id },
        select: { id: true, name: true },
      })
    : // Fall back to the pipeline's first stage rather than failing, so a
      // missing DEFAULT_STAGE cannot drop an incoming enquiry on the floor.
      await tx.stage.findFirst({
        where: { pipelineId: pipeline.id },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      });

  if (!stage) {
    throw new EnquiryInputError("Stage not found or does not belong to the pipeline");
  }

  return { pipeline, stage };
}

/// Creates one enquiry, reusing the customer row when the seller is already
/// known by **either** mobile or email. Every submission is a new enquiry
/// even for a returning seller — a second asset is a second thing to value,
/// not an edit of the first — but it's the same customer, so it lands in
/// their existing history instead of forking a duplicate person.
export async function createEnquiry(input: EnquiryInput, actorId: string | null) {
  const category = parseAssetCategory(input.category);
  if (!category) {
    throw new EnquiryInputError(`Unknown asset category: ${input.category}`);
  }

  const mobile = normalizeMobile(input.mobile ?? "");
  if (mobile.length < 10) {
    throw new EnquiryInputError("A valid 10-digit mobile number is required");
  }
  if (!input.name?.trim()) {
    throw new EnquiryInputError("Name is required");
  }

  const email = optionalText(input.email);

  return prisma.$transaction(async (tx) => {
    const { pipeline, stage } = await resolveDefaultPlacement(tx, input);

    // Mobile is the unique column, so it's checked first and wins if a
    // lookup by email would otherwise resolve to a *different* row — e.g. two
    // household members sharing a family email but each with their own
    // number. Only when no customer owns this mobile yet do we fall back to
    // an email match, which is what lets "same email, new number" (a seller
    // who switched phones) land on their existing record instead of forking
    // a duplicate.
    const existing =
      (await tx.customer.findUnique({ where: { mobile } })) ??
      (email
        ? await tx.customer.findFirst({ where: { email }, orderBy: { createdAt: "desc" } })
        : null);

    const customer = existing
      ? await tx.customer.update({
          where: { id: existing.id },
          data: {
            name: input.name.trim(),
            // Only ever different from what's already stored when the match
            // came from the email fallback above — safe to write because
            // that branch only runs when no other customer already owns
            // this mobile.
            mobile,
            // Only fill blanks on a repeat submission; a returning seller
            // should not lose a corrected email because they left the field
            // empty this time.
            ...(email && { email }),
            ...(optionalText(input.city) && { city: optionalText(input.city) }),
            ...(parsePreferredContact(input.preferredContact) && {
              preferredContact: parsePreferredContact(input.preferredContact),
            }),
          },
        })
      : await tx.customer.create({
          data: {
            name: input.name.trim(),
            mobile,
            email,
            city: optionalText(input.city),
            preferredContact: parsePreferredContact(input.preferredContact),
          },
        });

    const source = input.sourceTitle
      ? await tx.source.upsert({
          where: { title: input.sourceTitle },
          update: {},
          create: { title: input.sourceTitle },
        })
      : null;

    const enquiry = await tx.enquiry.create({
      data: {
        customerId: customer.id,
        category,
        jewelleryType: parseJewelleryType(input.jewelleryType),
        brand: optionalText(input.brand),
        metalWeightG: optionalNumber(input.metalWeight),
        caratWeight: optionalNumber(input.carat),
        shapeCut: parseShapeCut(input.shapeCut),
        condition: parseCondition(input.condition),
        certificateAvailable: parseYesNo(input.certificateAvailable),
        certificateLab: parseCertificateLab(input.certificateLab),
        purchaseYear: optionalNumber(input.purchaseYear),
        description: optionalText(input.description),
        notes: optionalText(input.notes),
        sourceId: source?.id ?? null,
        photos: input.photos?.length
          ? {
              create: input.photos.map((photo, index) => ({
                url: photo.url,
                key: photo.key ?? null,
                position: index,
              })),
            }
          : undefined,
        tags: input.tags?.length && actorId
          ? {
              create: input.tags.map((name) => ({ name, userId: actorId })),
            }
          : undefined,
        assignedTo: input.assignToUserId
          ? { create: { userId: input.assignToUserId } }
          : undefined,
        pipelineEntries: {
          create: { pipelineId: pipeline.id, stageId: stage.id, order: 0 },
        },
      },
      include: ENQUIRY_INCLUDE,
    });

    // No CRM user is behind a website submission (actorId is null), so the
    // timeline would otherwise fall back to a bare "Someone" for every
    // activity these create. Recording the source lets the timeline credit
    // it correctly instead of guessing from other enquiry fields.
    const activitySource = input.sourceTitle ?? null;

    const activities: Prisma.EnquiryActivityCreateManyInput[] = [
      {
        enquiryId: enquiry.id,
        userId: actorId,
        action: "ENQUIRY_CREATED",
        details: { name: customer.name, mobile: customer.mobile, category, source: activitySource },
      },
      {
        enquiryId: enquiry.id,
        userId: actorId,
        action: "PIPELINE_ADDED",
        details: { pipelineName: pipeline.name, stageName: stage.name, source: activitySource },
      },
    ];

    if (input.assignToUserId) {
      activities.push({
        enquiryId: enquiry.id,
        userId: actorId,
        action: "ASSIGNED_TO_UPDATED",
        details: { assignedUserIds: [input.assignToUserId], source: activitySource },
      });
    }

    for (const name of input.tags ?? []) {
      activities.push({
        enquiryId: enquiry.id,
        userId: actorId,
        action: "TAG_ADDED",
        details: { tagName: name, source: activitySource },
      });
    }

    await tx.enquiryActivity.createMany({ data: activities });

    return enquiry;
  });
}
