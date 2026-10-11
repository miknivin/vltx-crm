"use client";

import { PREFERRED_CONTACT_OPTIONS } from "@/app/lib/enquiry/constants";

const inputClass =
  "dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";
const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400";

export interface ContactFormState {
  name: string;
  mobile: string;
  city: string;
  email: string;
  preferredContact: string;
}

interface ContactStepProps {
  values: ContactFormState;
  onChange: <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => void;
}

export default function ContactStep({ values, onChange }: ContactStepProps) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Contact Details</h3>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Mobile Number</label>
            <input
              type="tel"
              value={values.mobile}
              onChange={(e) => onChange("mobile", e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              value={values.city}
              onChange={(e) => onChange("city", e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Email (optional)</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Preferred Contact</label>
          <div className="flex gap-2">
            {PREFERRED_CONTACT_OPTIONS.map((option) => {
              const selected = values.preferredContact === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange("preferredContact", option.value)}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                    selected
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-400"
                      : "border-gray-300 text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
