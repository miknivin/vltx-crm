import type { AssetCategory } from "@prisma/client";
import {
  CERTIFICATE_LAB_OPTIONS,
  CONDITION_OPTIONS,
  JEWELLERY_TYPE_OPTIONS,
  SHAPE_CUT_OPTIONS,
  WATCH_BRANDS,
} from "./constants";

/// Mirrors the website's per-category field set (D:\voltx
/// src/components/ValuationForm.tsx, CATEGORY_FIELD_SCHEMA), but keyed by the
/// Prisma enum and pulling its options from this CRM's own constants.ts
/// rather than duplicating a second copy of the vocabulary.

export type EnquiryFieldKind = "select" | "number" | "text" | "yesno" | "certLab" | "textarea";

export interface EnquiryFieldOption {
  value: string;
  label: string;
}

export interface EnquiryFieldDef {
  key: string;
  kind: EnquiryFieldKind;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: EnquiryFieldOption[];
  /// certLab only: the form-state key the conditional lab select writes to.
  labKey?: string;
}

/// The website splits diamond vs. gemstone shape lists; this CRM stores both
/// in one ShapeCut enum (their union), so the two lists below are filtered
/// views of SHAPE_CUT_OPTIONS rather than a separate vocabulary.
const DIAMOND_SHAPE_VALUES = new Set([
  "ROUND_BRILLIANT",
  "PRINCESS",
  "CUSHION",
  "OVAL",
  "EMERALD",
  "PEAR",
  "MARQUISE",
  "OTHER",
]);
const GEMSTONE_SHAPE_VALUES = new Set(["ROUND", "OVAL", "EMERALD", "PEAR", "MARQUISE", "OTHER"]);

const DIAMOND_SHAPE_OPTIONS = SHAPE_CUT_OPTIONS.filter((o) => DIAMOND_SHAPE_VALUES.has(o.value));
const GEMSTONE_SHAPE_OPTIONS = SHAPE_CUT_OPTIONS.filter((o) => GEMSTONE_SHAPE_VALUES.has(o.value));
const WATCH_BRAND_OPTIONS = WATCH_BRANDS.map((brand) => ({ value: brand, label: brand }));

/// Loose values keyed by field name — the set of keys in play depends on
/// which category is selected, so a fixed interface would just be a map of
/// optional strings anyway.
export type EnquiryDetailsValues = Record<string, string>;

export function isDetailsStepValid(category: AssetCategory, values: EnquiryDetailsValues): boolean {
  const schema = CATEGORY_FIELD_SCHEMA[category];
  return schema.every((def) => {
    if (!def.required) return true;
    const value = values[def.key];
    if (def.kind === "certLab") {
      if (!value) return false;
      if (value === "Yes" && def.labKey && !values[def.labKey]) return false;
      return true;
    }
    return Boolean(value);
  });
}

export const CATEGORY_FIELD_SCHEMA: Record<AssetCategory, EnquiryFieldDef[]> = {
  PLATINUM_METAL: [
    { key: "metalWeight", kind: "number", label: "Metal Weight (Appx, grams)", placeholder: "e.g. 25.5", required: true },
    { key: "certificateAvailable", kind: "yesno", label: "Certificate Available", required: true },
    { key: "purchaseYear", kind: "text", label: "Purchase Year (optional)", placeholder: "e.g. 2019", required: false },
    { key: "description", kind: "textarea", label: "Short Description (optional)", required: false },
  ],
  PLATINUM_JEWELLERY: [
    { key: "jewelleryType", kind: "select", label: "Category", options: JEWELLERY_TYPE_OPTIONS, required: true },
    { key: "metalWeight", kind: "number", label: "Metal Weight (Appx, grams)", placeholder: "e.g. 25.5", required: true },
    { key: "certificateAvailable", kind: "yesno", label: "Certificate Available", required: true },
    { key: "purchaseYear", kind: "text", label: "Purchase Year (optional)", placeholder: "e.g. 2019", required: false },
    { key: "description", kind: "textarea", label: "Short Description (optional)", required: false },
  ],
  LOOSE_DIAMOND: [
    { key: "carat", kind: "number", label: "Weight / Cts", placeholder: "e.g. 1.20", required: true },
    {
      key: "certificateAvailable",
      kind: "certLab",
      label: "Certificate",
      labKey: "certificateLab",
      options: CERTIFICATE_LAB_OPTIONS,
      required: true,
    },
    { key: "shapeCut", kind: "select", label: "Shape / Cut", options: DIAMOND_SHAPE_OPTIONS, required: true },
    { key: "description", kind: "textarea", label: "Short Description (optional)", required: false },
  ],
  DIAMOND_JEWELLERY: [
    { key: "jewelleryType", kind: "select", label: "Category", options: JEWELLERY_TYPE_OPTIONS, required: true },
    { key: "carat", kind: "number", label: "Weight / Cts", placeholder: "e.g. 1.20", required: true },
    {
      key: "certificateAvailable",
      kind: "certLab",
      label: "Certificate",
      labKey: "certificateLab",
      options: CERTIFICATE_LAB_OPTIONS,
      required: true,
    },
    { key: "shapeCut", kind: "select", label: "Shape / Cut", options: DIAMOND_SHAPE_OPTIONS, required: true },
    { key: "purchaseYear", kind: "text", label: "Purchase Year (optional)", placeholder: "e.g. 2019", required: false },
    { key: "description", kind: "textarea", label: "Short Description (optional)", required: false },
  ],
  PRECIOUS_GEMSTONE: [
    { key: "carat", kind: "number", label: "Weight / Cts (Appx)", placeholder: "e.g. 2.50", required: true },
    {
      key: "certificateAvailable",
      kind: "certLab",
      label: "Certificate",
      labKey: "certificateLab",
      options: CERTIFICATE_LAB_OPTIONS,
      required: true,
    },
    { key: "shapeCut", kind: "select", label: "Shape / Cut", options: GEMSTONE_SHAPE_OPTIONS, required: true },
    { key: "description", kind: "textarea", label: "Short Description (optional)", required: false },
  ],
  GEMSTONE_JEWELLERY: [
    { key: "jewelleryType", kind: "select", label: "Category", options: JEWELLERY_TYPE_OPTIONS, required: true },
    { key: "carat", kind: "number", label: "Weight / Cts (Appx)", placeholder: "e.g. 2.50", required: true },
    {
      key: "certificateAvailable",
      kind: "certLab",
      label: "Certificate",
      labKey: "certificateLab",
      options: CERTIFICATE_LAB_OPTIONS,
      required: true,
    },
    { key: "shapeCut", kind: "select", label: "Shape / Cut", options: GEMSTONE_SHAPE_OPTIONS, required: true },
    { key: "purchaseYear", kind: "text", label: "Purchase Year (optional)", placeholder: "e.g. 2019", required: false },
    { key: "description", kind: "textarea", label: "Short Description (optional)", required: false },
  ],
  LUXURY_WATCH: [
    { key: "brand", kind: "select", label: "Brand", options: WATCH_BRAND_OPTIONS, required: true },
    { key: "condition", kind: "select", label: "Condition", options: CONDITION_OPTIONS, required: true },
    { key: "certificateAvailable", kind: "yesno", label: "Original Invoice", required: true },
    { key: "purchaseYear", kind: "text", label: "Purchase Year (optional)", placeholder: "e.g. 2019", required: false },
    { key: "description", kind: "textarea", label: "Short Description (optional)", required: false },
  ],
  OTHER_LUXURY_ASSET: [
    { key: "brand", kind: "text", label: "Brand / Maker (optional)", placeholder: "e.g. Brand name", required: false },
    { key: "condition", kind: "select", label: "Condition", options: CONDITION_OPTIONS, required: true },
    { key: "certificateAvailable", kind: "yesno", label: "Certificate Available", required: true },
    { key: "purchaseYear", kind: "text", label: "Purchase Year (optional)", placeholder: "e.g. 2019", required: false },
    { key: "description", kind: "textarea", label: "Short Description (optional)", required: false },
  ],
};
