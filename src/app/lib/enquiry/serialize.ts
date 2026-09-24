import type { Prisma } from "@prisma/client";
import {
  ASSET_CATEGORY_LABELS,
  CERTIFICATE_LAB_LABELS,
  CONDITION_LABELS,
  JEWELLERY_TYPE_LABELS,
  PREFERRED_CONTACT_LABELS,
  SHAPE_CUT_LABELS,
} from "./constants";
import { encodeReference } from "./referenceCode";

/// Everything the list, board and detail views read. Keeping `assignedTo`,
/// `tags` and `pipelinesActive` in their original shapes means the kanban
/// board, the assign drawer and the filter panel keep working unchanged —
/// only the asset fields beside them are new.
export const ENQUIRY_INCLUDE = {
  customer: true,
  source: { select: { id: true, title: true } },
  valuedBy: { select: { id: true, name: true, email: true } },
  photos: { orderBy: { position: "asc" }, select: { id: true, url: true, key: true } },
  assignedTo: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  tags: { select: { id: true, name: true, userId: true, createdAt: true } },
  pipelineEntries: {
    select: { id: true, pipelineId: true, stageId: true, order: true },
  },
} satisfies Prisma.EnquiryInclude;

export type EnquiryWithRelations = Prisma.EnquiryGetPayload<{
  include: typeof ENQUIRY_INCLUDE;
}>;

/// Prisma returns Decimal instances, which `JSON.stringify` renders as an
/// object rather than a number. Everything numeric crosses the wire as a
/// plain number or null.
function decimal(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

export function serializeEnquiry(enquiry: EnquiryWithRelations) {
  const { customer } = enquiry;

  return {
    _id: enquiry.id,
    // A random-looking, obfuscated encoding of the sequence-backed column —
    // see referenceCode.ts. `reference` is what every caller reads; nothing
    // outside this module needs the raw integer.
    reference: encodeReference(enquiry.reference),

    // Contact details, flattened from the customer row. The list and board
    // components read `name`/`email`/`phone` off the record directly.
    name: customer.name,
    email: customer.email,
    phone: customer.mobile,
    city: customer.city,
    preferredContact: customer.preferredContact,
    preferredContactLabel: customer.preferredContact
      ? PREFERRED_CONTACT_LABELS[customer.preferredContact]
      : null,
    customerId: enquiry.customerId,

    // Asset details, as submitted on the website form.
    category: enquiry.category,
    categoryLabel: ASSET_CATEGORY_LABELS[enquiry.category],
    jewelleryType: enquiry.jewelleryType,
    jewelleryTypeLabel: enquiry.jewelleryType
      ? JEWELLERY_TYPE_LABELS[enquiry.jewelleryType]
      : null,
    brand: enquiry.brand,
    metalWeightG: decimal(enquiry.metalWeightG),
    caratWeight: decimal(enquiry.caratWeight),
    shapeCut: enquiry.shapeCut,
    shapeCutLabel: enquiry.shapeCut ? SHAPE_CUT_LABELS[enquiry.shapeCut] : null,
    condition: enquiry.condition,
    conditionLabel: enquiry.condition ? CONDITION_LABELS[enquiry.condition] : null,
    certificateAvailable: enquiry.certificateAvailable,
    certificateLab: enquiry.certificateLab,
    certificateLabLabel: enquiry.certificateLab
      ? CERTIFICATE_LAB_LABELS[enquiry.certificateLab]
      : null,
    purchaseYear: enquiry.purchaseYear,
    description: enquiry.description,
    photos: enquiry.photos.map((photo) => ({ _id: photo.id, url: photo.url, key: photo.key })),

    // Internal valuation.
    estimatedValue: decimal(enquiry.estimatedValue),
    offeredAmount: decimal(enquiry.offeredAmount),
    valuedAt: enquiry.valuedAt,
    valuedBy: enquiry.valuedBy
      ? { _id: enquiry.valuedBy.id, name: enquiry.valuedBy.name, email: enquiry.valuedBy.email }
      : null,
    probability: enquiry.probability,
    notes: enquiry.notes,
    source: enquiry.source?.title ?? null,
    sourceId: enquiry.sourceId,

    assignedTo: enquiry.assignedTo.map((assignment) => ({
      user: {
        _id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
      },
      time: assignment.assignedAt,
    })),
    tags: enquiry.tags.map((tag) => ({
      _id: tag.id,
      name: tag.name,
      user: tag.userId,
    })),
    pipelinesActive: enquiry.pipelineEntries.map((entry) => ({
      _id: entry.id,
      pipeline_id: entry.pipelineId,
      stage_id: entry.stageId,
      order: entry.order,
    })),

    createdAt: enquiry.createdAt,
    updatedAt: enquiry.updatedAt,
  };
}

export type SerializedEnquiry = ReturnType<typeof serializeEnquiry>;
