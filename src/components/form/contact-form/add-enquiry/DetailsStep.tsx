"use client";

import type { AssetCategory } from "@prisma/client";
import {
  CATEGORY_FIELD_SCHEMA,
  type EnquiryDetailsValues,
  type EnquiryFieldDef,
} from "@/app/lib/enquiry/categoryFieldSchema";
import { ASSET_CATEGORY_LABELS } from "@/app/lib/enquiry/constants";

const inputClass =
  "dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";
const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400";

interface DetailsStepProps {
  category: AssetCategory;
  values: EnquiryDetailsValues;
  onChange: (key: string, value: string) => void;
}

function YesNoToggle({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-2">
      {["Yes", "No"].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
            value === option
              ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-400"
              : "border-gray-300 text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-800"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function FieldControl({
  def,
  value,
  onChange,
}: {
  def: EnquiryFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  switch (def.kind) {
    case "select":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Select...</option>
          {def.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "number":
      return (
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "text":
      return (
        <input
          type="text"
          value={value}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "textarea":
      return (
        <textarea
          value={value}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          rows={3}
        />
      );
    case "yesno":
    case "certLab":
      return <YesNoToggle value={value} onChange={onChange} />;
    default:
      return null;
  }
}

export default function DetailsStep({ category, values, onChange }: DetailsStepProps) {
  const schema = CATEGORY_FIELD_SCHEMA[category];
  const textFields = schema.filter((def) => def.kind !== "textarea");
  const textareaFields = schema.filter((def) => def.kind === "textarea");

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Asset Details</h3>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{ASSET_CATEGORY_LABELS[category]}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {textFields.map((def) => (
          <div key={def.key}>
            <label className={labelClass}>{def.label}</label>
            <FieldControl
              def={def}
              value={values[def.key] ?? ""}
              onChange={(value) => onChange(def.key, value)}
            />
            {def.kind === "certLab" && values[def.key] === "Yes" && def.labKey && (
              <div className="mt-3">
                <label className={labelClass}>Certifying Lab</label>
                <select
                  value={values[def.labKey] ?? ""}
                  onChange={(e) => onChange(def.labKey as string, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {def.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
      {textareaFields.map((def) => (
        <div key={def.key} className="mt-4">
          <label className={labelClass}>{def.label}</label>
          <FieldControl
            def={def}
            value={values[def.key] ?? ""}
            onChange={(value) => onChange(def.key, value)}
          />
        </div>
      ))}
    </div>
  );
}
