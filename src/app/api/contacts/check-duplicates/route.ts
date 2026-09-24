import { NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { normalizeMobile } from "@/app/lib/enquiry/createEnquiry";

interface IncomingRow {
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

/// Bulk-import pre-check. Mirrors createEnquiry's own matching: a row is a
/// duplicate if an existing customer already owns its mobile **or** its
/// email — the same seller can resurface under a new number but the same
/// address, or vice versa. The website form doesn't require an email at all,
/// so most rows will only ever match on mobile.
export async function POST(request: Request) {
  try {
    const { contacts }: { contacts: IncomingRow[] } = await request.json();

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "Invalid or empty contacts array" },
        { status: 400 }
      );
    }

    const rows = contacts.map((row) => ({
      row,
      mobile: normalizeMobile(row.mobile ?? row.phone ?? ""),
      email: row.email?.trim().toLowerCase() || null,
    }));

    const missingMobile = rows.filter(({ mobile }) => mobile.length < 10);
    if (missingMobile.length) {
      return NextResponse.json(
        { error: "All rows must have a valid 10-digit mobile number" },
        { status: 400 }
      );
    }

    const emails = rows.map(({ email }) => email).filter((e): e is string => Boolean(e));

    const existing = await prisma.customer.findMany({
      where: {
        OR: [
          { mobile: { in: rows.map(({ mobile }) => mobile) } },
          ...(emails.length ? [{ email: { in: emails, mode: "insensitive" as const } }] : []),
        ],
      },
      select: { mobile: true, email: true },
    });
    const knownMobiles = new Set(existing.map((customer) => customer.mobile));
    const knownEmails = new Set(
      existing.map((customer) => customer.email?.toLowerCase()).filter(Boolean)
    );

    const isKnown = ({ mobile, email }: (typeof rows)[number]) =>
      knownMobiles.has(mobile) || (email !== null && knownEmails.has(email));

    const duplicates = rows.filter(isKnown);
    const fresh = rows.filter((row) => !isKnown(row));

    const describe = ({ row, mobile }: (typeof rows)[number]) => ({
      email: row.email ?? null,
      name: row.name ?? null,
      phone: mobile,
    });

    return NextResponse.json(
      {
        totalContacts: contacts.length,
        duplicateCount: duplicates.length,
        newCount: fresh.length,
        duplicates: duplicates.map(describe),
        newContacts: fresh.map(describe),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error checking duplicate enquiries:", error);
    return NextResponse.json({ error: "Failed to process rows" }, { status: 500 });
  }
}
