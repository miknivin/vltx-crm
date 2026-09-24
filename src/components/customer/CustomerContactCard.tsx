/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { CustomerDetail, useUpdateCustomerMutation } from "@/app/redux/api/customerApi";
import { PREFERRED_CONTACT_OPTIONS } from "@/app/lib/enquiry/constants";

interface CustomerContactCardProps {
  customer: CustomerDetail;
  isAdmin: boolean;
}

const inputClass =
  "dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";
const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-white";

function Field({ label, value, id }: { label: string; value: React.ReactNode; id?: string }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div
        id={id}
        className="dark:bg-dark-900 min-h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      >
        {value ?? "N/A"}
      </div>
    </div>
  );
}

export default function CustomerContactCard({ customer, isAdmin }: CustomerContactCardProps) {
  const [updateCustomer, { isLoading }] = useUpdateCustomerMutation();
  const [form, setForm] = useState({
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email ?? "",
    city: customer.city ?? "",
    preferredContact: customer.preferredContact ?? "",
    notes: customer.notes ?? "",
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCustomer({
        id: customer._id,
        name: form.name,
        mobile: form.mobile,
        email: form.email || null,
        city: form.city || null,
        preferredContact: form.preferredContact || null,
        notes: form.notes || null,
      }).unwrap();
      toast.success("Contact updated");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update contact");
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Contact Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" value={customer.name} />
          <Field id="mobile" label="Phone" value={customer.mobile} />
          <Field id="email" label="Email" value={customer.email} />
          <Field id="city" label="City" value={customer.city} />
          <Field id="preferredContact" label="Preferred Contact" value={customer.preferredContactLabel} />
        </div>
        <Field id="notes" label="Internal Notes" value={customer.notes} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Contact Details</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>Name</label>
          <input id="name" className={inputClass} value={form.name} onChange={handleChange("name")} />
        </div>
        <div>
          <label htmlFor="mobile" className={labelClass}>Phone</label>
          <input id="mobile" className={inputClass} value={form.mobile} onChange={handleChange("mobile")} />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" type="email" className={inputClass} value={form.email} onChange={handleChange("email")} />
        </div>
        <div>
          <label htmlFor="city" className={labelClass}>City</label>
          <input id="city" className={inputClass} value={form.city} onChange={handleChange("city")} />
        </div>
        <div>
          <label htmlFor="preferredContact" className={labelClass}>Preferred Contact</label>
          <select
            id="preferredContact"
            className={inputClass}
            value={form.preferredContact}
            onChange={handleChange("preferredContact")}
          >
            <option value="">Not set</option>
            {PREFERRED_CONTACT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="notes" className={labelClass}>Internal Notes</label>
        <textarea
          id="notes"
          rows={4}
          className={inputClass}
          value={form.notes}
          onChange={handleChange("notes")}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {isLoading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
