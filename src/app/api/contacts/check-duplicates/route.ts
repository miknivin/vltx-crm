import { NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { normalizeMobile } from "@/app/lib/enquiry/createEnquiry";

interface IncomingRow {
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

/// Bulk-import pre-check. The dedupe key is the mobile number, not the email:
/// a seller is identified by the number they are called back on, and the
/// website form does not require an email at all.
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
    }));

    const missingMobile = rows.filter(({ mobile }) => mobile.length < 10);
    if (missingMobile.length) {
      return NextResponse.json(
        { error: "All rows must have a valid 10-digit mobile number" },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findMany({
      where: { mobile: { in: rows.map(({ mobile }) => mobile) } },
      select: { mobile: true },
    });
    const known = new Set(existing.map((customer) => customer.mobile));

    const duplicates = rows.filter(({ mobile }) => known.has(mobile));
    const fresh = rows.filter(({ mobile }) => !known.has(mobile));

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
