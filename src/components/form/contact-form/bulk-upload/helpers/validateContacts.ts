import { toast } from 'react-toastify';
import type { ImportRow } from "@/app/redux/api/contactApi";

/// Validates the raw spreadsheet rows before they are sent for import. The
/// mobile number is what matters — it is the dedupe key, and the valuation
/// form does not require an email at all.
export const validateContacts = (contacts: ImportRow[]): boolean => {
  const invalidContacts: { contact: ImportRow; errors: string[] }[] = [];
  
  contacts.forEach((contact, index) => {
    const errors: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const identifier = contact.email || contact.name || `contact ${index + 1}`;

    // A mobile number is required and must carry 10 usable digits.
    const digits = (contact.phone ?? '').replace(/\D/g, '');
    if (digits.length < 10) {
      errors.push(`Invalid mobile: ${contact.phone ?? '(blank)'} (needs 10 digits)`);
    }

    // Validate email (non-empty string)
    if (contact.email) {
      if (typeof contact.email !== 'string' || contact.email.trim() === '') {
        errors.push(`Invalid email: ${contact.email} (must be a non-empty string)`);
      }
    }

    if (errors.length > 0) {
      invalidContacts.push({ contact, errors });
    }
  });

  // Display warnings for invalid contacts
  if (invalidContacts.length > 0) {
    invalidContacts.forEach(({ contact, errors }) => {
      const identifier = contact.email || contact.name || 'contact';
      errors.forEach((error) => {
        toast.warning(`Failed to process ${identifier}: ${error}`);
      });
    });
    return false;
  }

  return true;
};