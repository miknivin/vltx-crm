import React from "react";
import {
  CATEGORY_OPTIONS,
  CERTIFICATE_LAB_OPTIONS,
  CONDITION_OPTIONS,
} from "@/app/lib/enquiry/constants";

const selectClass =
  "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";
const inputClass = selectClass;
const labelClass =
  "block mb-2 text-sm font-medium text-gray-900 dark:text-white";

export interface AssetFilterState {
  categories: string[];
  conditions: string[];
  certificateLabs: string[];
  certificateAvailable: "" | "yes" | "no";
  brand: string;
  estimatedValue: { min: string; max: string };
  caratWeight: { min: string; max: string };
  metalWeightG: { min: string; max: string };
  purchaseYear: { min: string; max: string };
  valuationStatus: "" | "valued" | "not_valued";
  conversion: "" | "converted" | "not_converted";
  assigneeState: "" | "unassigned" | "assigned" | "multiple";
}

export const EMPTY_ASSET_FILTERS: AssetFilterState = {
  categories: [],
  conditions: [],
  certificateLabs: [],
  certificateAvailable: "",
  brand: "",
  estimatedValue: { min: "", max: "" },
  caratWeight: { min: "", max: "" },
  metalWeightG: { min: "", max: "" },
  purchaseYear: { min: "", max: "" },
  valuationStatus: "",
  conversion: "",
  assigneeState: "",
};

interface Props {
  value: AssetFilterState;
  onChange: (next: AssetFilterState) => void;
  disabled?: boolean;
}

/// Chips rather than a multi-select: a multi-select of eight categories is
/// awkward on a narrow drawer, and the chips double as a summary of what is
/// currently applied.
function ChipGroup({
  label,
  options,
  selected,
  onToggle,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-4">
      <span className={labelClass}>{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(option.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                active
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-300 bg-gray-50 text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangeInputs({
  label,
  hint,
  value,
  onChange,
  disabled,
  step,
}: {
  label: string;
  hint?: string;
  value: { min: string; max: string };
  onChange: (next: { min: string; max: string }) => void;
  disabled?: boolean;
  step?: string;
}) {
  return (
    <div className="mb-4">
      <span className={labelClass}>
        {label}
        {hint && <span className="ml-1 font-normal text-gray-500">{hint}</span>}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          className={inputClass}
          placeholder="Min"
          value={value.min}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, min: e.target.value })}
        />
        <span className="text-gray-400">–</span>
        <input
          type="number"
          inputMode="decimal"
          step={step}
          className={inputClass}
          placeholder="Max"
          value={value.max}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, max: e.target.value })}
        />
      </div>
    </div>
  );
}

export default function AssetFilters({ value, onChange, disabled }: Props) {
  const set = <K extends keyof AssetFilterState>(key: K, next: AssetFilterState[K]) =>
    onChange({ ...value, [key]: next });

  const toggle = (key: "categories" | "conditions" | "certificateLabs", option: string) => {
    const current = value[key];
    set(
      key,
      current.includes(option)
        ? current.filter((entry) => entry !== option)
        : [...current, option]
    );
  };

  return (
    <div className="mb-2 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h6 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
        Asset
      </h6>

      <ChipGroup
        label="Category"
        options={CATEGORY_OPTIONS}
        selected={value.categories}
        onToggle={(option) => toggle("categories", option)}
        disabled={disabled}
      />

      <ChipGroup
        label="Condition"
        options={CONDITION_OPTIONS}
        selected={value.conditions}
        onToggle={(option) => toggle("conditions", option)}
        disabled={disabled}
      />

      <div className="mb-4">
        <label htmlFor="filter-certificate" className={labelClass}>
          Certificate / original invoice
        </label>
        <select
          id="filter-certificate"
          className={selectClass}
          value={value.certificateAvailable}
          disabled={disabled}
          onChange={(e) =>
            set("certificateAvailable", e.target.value as AssetFilterState["certificateAvailable"])
          }
        >
          <option value="">Any</option>
          <option value="yes">Available</option>
          <option value="no">Not available</option>
        </select>
      </div>

      <ChipGroup
        label="Certifying lab"
        options={CERTIFICATE_LAB_OPTIONS}
        selected={value.certificateLabs}
        onToggle={(option) => toggle("certificateLabs", option)}
        disabled={disabled}
      />

      <div className="mb-4">
        <label htmlFor="filter-brand" className={labelClass}>
          Brand / maker
        </label>
        <input
          id="filter-brand"
          type="text"
          className={inputClass}
          placeholder="e.g. Rolex"
          value={value.brand}
          disabled={disabled}
          onChange={(e) => set("brand", e.target.value)}
        />
      </div>

      <RangeInputs
        label="Carat weight"
        hint="(cts)"
        step="0.01"
        value={value.caratWeight}
        onChange={(next) => set("caratWeight", next)}
        disabled={disabled}
      />

      <RangeInputs
        label="Metal weight"
        hint="(grams)"
        step="0.01"
        value={value.metalWeightG}
        onChange={(next) => set("metalWeightG", next)}
        disabled={disabled}
      />

      <RangeInputs
        label="Purchase year"
        value={value.purchaseYear}
        onChange={(next) => set("purchaseYear", next)}
        disabled={disabled}
      />

      <h6 className="mb-3 mt-6 text-sm font-semibold text-gray-700 dark:text-gray-200">
        Valuation
      </h6>

      <RangeInputs
        label="Estimated value"
        hint="(₹)"
        value={value.estimatedValue}
        onChange={(next) => set("estimatedValue", next)}
        disabled={disabled}
      />

      <div className="mb-4">
        <label htmlFor="filter-valuation-status" className={labelClass}>
          Valuation status
        </label>
        <select
          id="filter-valuation-status"
          className={selectClass}
          value={value.valuationStatus}
          disabled={disabled}
          onChange={(e) =>
            set("valuationStatus", e.target.value as AssetFilterState["valuationStatus"])
          }
        >
          <option value="">Any</option>
          <option value="valued">Valued</option>
          <option value="not_valued">Awaiting valuation</option>
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="filter-conversion" className={labelClass}>
          Outcome
        </label>
        <select
          id="filter-conversion"
          className={selectClass}
          value={value.conversion}
          disabled={disabled}
          onChange={(e) => set("conversion", e.target.value as AssetFilterState["conversion"])}
        >
          <option value="">Any</option>
          <option value="converted">Purchased</option>
          <option value="not_converted">Still open</option>
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="filter-assignee-state" className={labelClass}>
          Assignment
        </label>
        <select
          id="filter-assignee-state"
          className={selectClass}
          value={value.assigneeState}
          disabled={disabled}
          onChange={(e) =>
            set("assigneeState", e.target.value as AssetFilterState["assigneeState"])
          }
        >
          <option value="">Any</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Has an owner</option>
          <option value="multiple">Multiple owners</option>
        </select>
      </div>
    </div>
  );
}

/// Strips the empty strings the form uses for "not set", so the request body
/// carries only what the person actually chose.
export function toFilterPayload(state: AssetFilterState) {
  const range = (value: { min: string; max: string }) => {
    const payload: { min?: number; max?: number } = {};
    if (value.min !== "") payload.min = Number(value.min);
    if (value.max !== "") payload.max = Number(value.max);
    return Object.keys(payload).length ? payload : undefined;
  };

  return {
    ...(state.categories.length && { categories: state.categories }),
    ...(state.conditions.length && { conditions: state.conditions }),
    ...(state.certificateLabs.length && { certificateLabs: state.certificateLabs }),
    ...(state.certificateAvailable && {
      certificateAvailable: state.certificateAvailable,
    }),
    ...(state.brand && { brand: state.brand }),
    ...(range(state.estimatedValue) && { estimatedValue: range(state.estimatedValue) }),
    ...(range(state.caratWeight) && { caratWeight: range(state.caratWeight) }),
    ...(range(state.metalWeightG) && { metalWeightG: range(state.metalWeightG) }),
    ...(range(state.purchaseYear) && { purchaseYear: range(state.purchaseYear) }),
    ...(state.valuationStatus && { valuationStatus: state.valuationStatus }),
    ...(state.conversion && { conversion: state.conversion }),
    ...(state.assigneeState && { assigneeState: state.assigneeState }),
  };
}
