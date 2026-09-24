import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "@/app/api/middlewares/auth";

/// Company settings are a single row. The id is fixed rather than generated so
/// there is exactly one, with no "which row is current?" question to answer.
const COMPANY_SETTINGS_ID = "company";

interface UpdateCompanySettingsBody {
  companyName?: string;
  legalName?: string;
  logo?: { public_id: string; url: string };
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
}

function serialize(settings: Awaited<ReturnType<typeof prisma.companySettings.findUnique>>) {
  if (!settings) return null;
  return {
    _id: settings.id,
    companyName: settings.companyName,
    legalName: settings.legalName,
    logo: settings.logoUrl
      ? { public_id: settings.logoPublicId ?? "", url: settings.logoUrl }
      : null,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    website: settings.website,
    taxId: settings.taxId,
    updatedAt: settings.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    await isAuthenticatedUser(req);

    const settings = await prisma.companySettings.findUnique({
      where: { id: COMPANY_SETTINGS_ID },
    });

    return NextResponse.json(
      { message: "Company settings fetched successfully", data: serialize(settings) },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login") || message.includes("not found")) {
      return NextResponse.json({ message }, { status: 401 });
    }
    console.error("Error fetching company settings:", error);
    return NextResponse.json(
      { message: "Failed to fetch company settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);
    authorizeRoles(user, "admin");

    const body = (await req.json()) as UpdateCompanySettingsBody;

    const data = {
      ...(body.companyName !== undefined && { companyName: body.companyName || null }),
      ...(body.legalName !== undefined && { legalName: body.legalName || null }),
      ...(body.address !== undefined && { address: body.address || null }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.phone !== undefined && { phone: body.phone || null }),
      ...(body.website !== undefined && { website: body.website || null }),
      ...(body.taxId !== undefined && { taxId: body.taxId || null }),
      ...(body.logo !== undefined && {
        logoPublicId: body.logo?.public_id ?? null,
        logoUrl: body.logo?.url ?? null,
      }),
    };

    const updated = await prisma.companySettings.upsert({
      where: { id: COMPANY_SETTINGS_ID },
      update: data,
      create: { id: COMPANY_SETTINGS_ID, ...data },
    });

    return NextResponse.json(
      { message: "Company settings updated successfully", data: serialize(updated) },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not allowed") {
      return NextResponse.json({ message }, { status: 403 });
    }
    if (message.includes("login")) {
      return NextResponse.json({ message }, { status: 401 });
    }
    console.error("Error updating company settings:", error);
    return NextResponse.json(
      { message: "Failed to update company settings" },
      { status: 500 }
    );
  }
}
