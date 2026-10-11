"use client";

import { useState } from "react";
import SourceAutocomplete from "../SourceAutocomplete";
import Chip from "@/components/ui/chips/Chip";

const inputClass =
  "dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";
const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400";

interface Stage {
  _id: string;
  name: string;
}

export interface CrmDetailsFormState {
  source: string;
  stage: string;
  tags: string[];
  notes: string;
}

interface CrmDetailsStepProps {
  values: CrmDetailsFormState;
  stages: Stage[];
  onChange: <K extends keyof CrmDetailsFormState>(key: K, value: CrmDetailsFormState[K]) => void;
}

export default function CrmDetailsStep({ values, stages, onChange }: CrmDetailsStepProps) {
  const [tagInput, setTagInput] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (values.tags.includes(trimmed)) {
      setTagError(`Tag "${trimmed}" already exists.`);
      return;
    }
    onChange("tags", [...values.tags, trimmed]);
    setTagInput("");
    setTagError(null);
  };

  const removeTag = (tag: string) => {
    onChange(
      "tags",
      values.tags.filter((t) => t !== tag)
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">CRM Details</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Pipeline Stage</label>
          <select
            value={values.stage}
            onChange={(e) => onChange("stage", e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select a stage
            </option>
            {stages.map((stage) => (
              <option key={stage._id} value={stage._id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
        <SourceAutocomplete value={values.source} onChange={(title) => onChange("source", title)} />
      </div>
      <div>
        <label className={labelClass}>Tags (optional)</label>
        <div
          className="dark:bg-dark-900 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          role="group"
          aria-label="Enter tags"
        >
          <div className="mb-2 flex flex-wrap gap-2">
            {values.tags.map((tag) => (
              <Chip key={tag} text={tag} onRemove={() => removeTag(tag)} />
            ))}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            onBlur={() => addTag(tagInput)}
            placeholder="Add a tag..."
            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-white/90 dark:placeholder:text-white/30"
            aria-label="Add new tag"
          />
          {tagError && <p className="mt-1 text-sm text-red-500">{tagError}</p>}
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes (optional)</label>
        <textarea
          value={values.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          className={inputClass}
          rows={3}
        />
      </div>
    </div>
  );
}
