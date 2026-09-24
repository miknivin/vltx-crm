import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { createEnquiry, EnquiryInputError } from "@/app/lib/enquiry/createEnquiry";
import { serializeEnquiry } from "@/app/lib/enquiry/serialize";

/**
 * Intake for the VLTX website's valuation form.
 *
 * Unauthenticated in the CRM's usual sense — the website has no CRM login —
 * so it is gated on a shared secret sent in `x-vltx-signature`. The secret
 * lives in `VALUATION_INTAKE_SECRET` on both sides.
 *
 * The website is not wired to this endpoint yet; it exists so that wiring is
 * a single fetch on the website side when you want it.
 */

const PhotoSchema = z.object({
  url: z.string().url(),
  key: z.string().optional().nullable(),
});

/// Mirrors the form's `FormState`, in the labels the form itself uses.
const PayloadSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(10),
  email: z.string().email().optional().nullable().or(z.literal("")),
  city: z.string().optional().nullable(),
  preferredContact: z.string().optional().nullable(),

  category: z.string().min(1),
  jewelleryType: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  metalWeight: z.union([z.string(), z.number()]).optional().nullable(),
  carat: z.union([z.string(), z.number()]).optional().nullable(),
  shapeCut: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  certificateAvailable: z.union([z.string(), z.boolean()]).optional().nullable(),
  certificateLab: z.string().optional().nullable(),
  purchaseYear: z.union([z.string(), z.number()]).optional().nullable(),
  description: z.string().optional().nullable(),
  photos: z.array(PhotoSchema).optional(),
});

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.VALUATION_INTAKE_SECRET;
  if (!secret) return false;

  const provided = req.headers.get("x-vltx-signature") ?? "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);

  // Length check first: timingSafeEqual throws on a length mismatch, and the
  // length of a rejected secret is not worth leaking through a 500.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof PayloadSchema>;
  try {
    const parsed = PayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const enquiry = await createEnquiry(
      {
        ...payload,
        email: payload.email || null,
        sourceTitle: "Website Valuation Form",
      },
      // No CRM user is behind a website submission, so the activity is
      // recorded with no actor rather than attributed to someone.
      null
    );

    const serialized = serializeEnquiry(enquiry);

    return NextResponse.json(
      {
        success: true,
        reference: serialized.reference,
        enquiry: serialized,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof EnquiryInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error accepting valuation enquiry:", error);
    return NextResponse.json({ error: "Could not record the enquiry" }, { status: 500 });
  }
}

export const runtime = "nodejs";
