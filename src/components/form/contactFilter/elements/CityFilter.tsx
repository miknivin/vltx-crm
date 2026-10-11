import React from "react";

interface CityFilterProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function CityFilter({ value, onChange, disabled }: CityFilterProps) {
  return (
    <div className="mb-4">
      <label htmlFor="contact-city" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
        City
      </label>
      <input
        type="text"
        id="contact-city"
        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        placeholder="e.g. Kochi"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
