import type {
  AssetCategory,
  AssetCondition,
  CertificateLab,
  JewelleryType,
  PreferredContact,
  ShapeCut,
} from "@prisma/client";

/// Single source of truth for the valuation vocabulary. The database stores
/// enums; the website form, the CRM UI and the AI filter all speak in the
/// labels a person would type. Everything that crosses that line goes through
/// the maps here rather than inventing its own spelling.

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  PLATINUM_METAL: "Platinum Metal",
  PLATINUM_JEWELLERY: "Platinum Jewellery",
  LOOSE_DIAMOND: "Loose Diamond",
  DIAMOND_JEWELLERY: "Diamond Jewellery",
  PRECIOUS_GEMSTONE: "Precious Gemstone",
  GEMSTONE_JEWELLERY: "Gemstone Jewellery",
  LUXURY_WATCH: "Luxury Watch",
  OTHER_LUXURY_ASSET: "Other Luxury Asset",
};

export const JEWELLERY_TYPE_LABELS: Record<JewelleryType, string> = {
  NECKLACE: "Necklace",
  EARRING: "Earring",
  BANGLE: "Bangle",
  RINGS: "Rings",
  PENDANT: "Pendant",
  OTHERS: "Others",
};

export const SHAPE_CUT_LABELS: Record<ShapeCut, string> = {
  ROUND_BRILLIANT: "Round Brilliant",
  ROUND: "Round",
  PRINCESS: "Princess",
  CUSHION: "Cushion",
  OVAL: "Oval",
  EMERALD: "Emerald",
  PEAR: "Pear",
  MARQUISE: "Marquise",
  OTHER: "Other",
};

export const CONDITION_LABELS: Record<AssetCondition, string> = {
  AS_NEW: "As New",
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
};

export const CERTIFICATE_LAB_LABELS: Record<CertificateLab, string> = {
  GIA: "GIA",
  IGI: "IGI",
  HRD: "HRD",
  OTHERS: "Others",
};

export const PREFERRED_CONTACT_LABELS: Record<PreferredContact, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

/// Watch brands the form offers. Stored as free text rather than an enum,
/// because "Other Luxury Asset" lets the seller type any maker.
export const WATCH_BRANDS = [
  "Patek Philippe",
  "Audemars Piguet",
  "Rolex",
  "Omega",
  "Cartier",
  "Others",
] as const;

function invert<T extends string>(labels: Record<T, string>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [value, label] of Object.entries(labels) as [T, string][]) {
    map.set(label.toLowerCase(), value);
    // Also accept the raw enum name, so an API client or an AI-planned filter
    // can pass either "Loose Diamond" or "LOOSE_DIAMOND".
    map.set(value.toLowerCase(), value);
  }
  return map;
}

const CATEGORY_BY_LABEL = invert(ASSET_CATEGORY_LABELS);
const JEWELLERY_TYPE_BY_LABEL = invert(JEWELLERY_TYPE_LABELS);
const SHAPE_CUT_BY_LABEL = invert(SHAPE_CUT_LABELS);
const CONDITION_BY_LABEL = invert(CONDITION_LABELS);
const CERTIFICATE_LAB_BY_LABEL = invert(CERTIFICATE_LAB_LABELS);
const PREFERRED_CONTACT_BY_LABEL = invert(PREFERRED_CONTACT_LABELS);

export function parseAssetCategory(value: unknown): AssetCategory | null {
  return CATEGORY_BY_LABEL.get(String(value ?? "").trim().toLowerCase()) ?? null;
}

export function parseJewelleryType(value: unknown): JewelleryType | null {
  return JEWELLERY_TYPE_BY_LABEL.get(String(value ?? "").trim().toLowerCase()) ?? null;
}

export function parseShapeCut(value: unknown): ShapeCut | null {
  return SHAPE_CUT_BY_LABEL.get(String(value ?? "").trim().toLowerCase()) ?? null;
}

export function parseCondition(value: unknown): AssetCondition | null {
  return CONDITION_BY_LABEL.get(String(value ?? "").trim().toLowerCase()) ?? null;
}

export function parseCertificateLab(value: unknown): CertificateLab | null {
  return CERTIFICATE_LAB_BY_LABEL.get(String(value ?? "").trim().toLowerCase()) ?? null;
}

export function parsePreferredContact(value: unknown): PreferredContact | null {
  return PREFERRED_CONTACT_BY_LABEL.get(String(value ?? "").trim().toLowerCase()) ?? null;
}

/// The form sends "Yes"/"No"; the column is a nullable boolean.
export function parseYesNo(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "yes" || text === "true") return true;
  if (text === "no" || text === "false") return false;
  return null;
}

/// Option lists for the filter panel's dropdowns, in the order the website
/// form presents them.
export const CATEGORY_OPTIONS = (
  Object.entries(ASSET_CATEGORY_LABELS) as [AssetCategory, string][]
).map(([value, label]) => ({ value, label }));

export const CONDITION_OPTIONS = (
  Object.entries(CONDITION_LABELS) as [AssetCondition, string][]
).map(([value, label]) => ({ value, label }));

export const CERTIFICATE_LAB_OPTIONS = (
  Object.entries(CERTIFICATE_LAB_LABELS) as [CertificateLab, string][]
).map(([value, label]) => ({ value, label }));

export const JEWELLERY_TYPE_OPTIONS = (
  Object.entries(JEWELLERY_TYPE_LABELS) as [JewelleryType, string][]
).map(([value, label]) => ({ value, label }));

export const SHAPE_CUT_OPTIONS = (
  Object.entries(SHAPE_CUT_LABELS) as [ShapeCut, string][]
).map(([value, label]) => ({ value, label }));
