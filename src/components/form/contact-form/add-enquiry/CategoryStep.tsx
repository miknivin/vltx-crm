"use client";

import type { AssetCategory } from "@prisma/client";
import { ASSET_CATEGORY_LABELS } from "@/app/lib/enquiry/constants";

const CATEGORIES = Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[];

interface CategoryStepProps {
  value: AssetCategory | null;
  onChange: (category: AssetCategory) => void;
}

export default function CategoryStep({ value, onChange }: CategoryStepProps) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
        Select Asset Category
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORIES.map((category) => {
          const selected = value === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onChange(category)}
              className={`rounded-lg border px-4 py-4 text-left text-sm font-medium transition ${
                selected
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-400"
                  : "border-gray-300 text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-800"
              }`}
            >
              {ASSET_CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
