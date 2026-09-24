/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import BulkUploadComponent from './BulkUploadComponent';
import FieldMapper from './FieldMapper';
import BulkUploadAssign from './BulkUploadAssign';
import { useGetTeamMembersQuery } from '@/app/redux/api/userApi';
import type { IContact } from "@/app/types/enquiry";
import { toast } from 'react-toastify';
import type { IUser } from "@/app/types/user";
import { useBulkImportContactsMutation, useCheckContactDuplicatesMutation } from "@/app/redux/api/contactApi";
import { validateContacts } from "./helpers/validateContacts";

interface ContactImportStepperProps {
  onClose: () => void;
}

interface ParsedContact {
  [key: string]: string | boolean;
}

/// One spreadsheet row with its columns renamed to enquiry fields. The values
/// stay as the raw cell text — `/api/contacts/bulk` parses them, because a
/// cell is always a string while the columns it feeds are numbers and enums.
type MappedRow = Partial<Record<keyof IContact, string>>;

export interface DuplicateCheckResult {
  totalContacts: number;
  duplicateCount: number;
  newCount: number;
  duplicates: { email: string | null; name: string | null; phone: string }[];
  newContacts: { email: string | null; name: string | null; phone: string }[];
}
const steps = [
  { title: 'Map Fields', description: 'Map CSV/Excel headers to contact fields' },
  { title: 'Assign Contacts', description: 'Assign contacts to team members' },
];

export default function ContactImportStepper({ onClose }: ContactImportStepperProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, keyof IContact | ''>>({});
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [assignType, setAssignType] = useState<'' | 'every' | 'equally' | 'roundRobin'>('roundRobin');
  const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
  const [addToPipeline, setAddToPipeline] = useState(true);
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<DuplicateCheckResult | null>(null);
  const [duplicateCheckError, setDuplicateCheckError] = useState<string | null>(null);
  // Fetch team members
  const { data: teamMembers, isLoading, error: queryError } = useGetTeamMembersQuery({
    page: 1,
    limit: 10,
    search: '',
  });

  // Use bulk import mutation
  const [bulkImportContacts, { isLoading: isImporting }] = useBulkImportContactsMutation();
    const [checkContactDuplicates, { isLoading: isCheckingDuplicates }] = useCheckContactDuplicatesMutation();
  // Pre-select all team members when data is available
  useEffect(() => {
    if (teamMembers?.users && Array.isArray(teamMembers.users)) {
      setSelectedUsers(teamMembers.users.filter((user) => user._id));
    }
  }, [teamMembers]);

  // Handle file upload results
  const handleFileUpload = (contacts: ParsedContact[], headers: string[], fileName: string) => {
    setParsedContacts(contacts);
    setHeaders(headers);
    setFileName(fileName);
    setFieldMappings(headers.reduce((acc, header) => ({ ...acc, [header]: '' }), {}));
  };

  // Handle field mapping changes
  const handleMappingChange = (header: string, field: keyof IContact | '') => {
    setFieldMappings((prev) => ({ ...prev, [header]: field }));
  };

  // Handle assign type change
  const handleAssignTypeChange = (value: '' | 'every' | 'equally' | 'roundRobin') => {
    setAssignType(value);
  };

  // Handle user selection changes
  const handleSelectUser = (member: IUser) => {
    if (member._id && !selectedUsers.some((user) => user._id === member._id)) {
      setSelectedUsers((prev) => [...prev, member]);
    }
  };

  // Handle user removal
  const handleRemoveUser = (userId: string | undefined) => {
    if (userId) {
      setSelectedUsers((prev) => prev.filter((user) => user._id !== userId));
    }
  };

  // Handle pipeline toggle
  const handlePipelineToggle = (checked: boolean) => {
    setAddToPipeline(checked);
  };

  // Handle default source change
  const handleSourceChange = (title: string) => {
    setSource(title);
  };

  // Handle backward navigation
  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  // Handle step click for backward navigation
  const handleStepClick = (index: number) => {
    if (index <= activeStep) {
      setActiveStep(index);
    }
  };

  // Validate and proceed to the next step
  const handleNext = async () => {
    if (activeStep === 0) {
      const requiredFields = ['name', 'phone', 'category'];
      const mappedFields = Object.values(fieldMappings);
      const hasRequiredFields = requiredFields.every((field) =>
        mappedFields.includes(field as keyof IContact)
      );

      if (!hasRequiredFields) {
        toast.error('Please map the required fields: Name, Mobile and Asset Category');
        return;
      }

      // Prepare contacts for duplicate check
      const contactsToCheck = parsedContacts.map((contact) => {
        const mappedContact: MappedRow = {};
        Object.entries(fieldMappings).forEach(([header, field]) => {
          if (field && contact[header]) {
            mappedContact[field] = String(contact[header]);
          }
        });
        return mappedContact;
      });

      try {
        const result = await checkContactDuplicates({ contacts: contactsToCheck }).unwrap();
        // Update parsedContacts with isDuplicate field
        // Match on mobile, which is what the server dedupes on — and compare
        // digits only, so "+91 96332 26916" and "9633226916" are one person.
        const phoneHeader = Object.keys(fieldMappings).find(
          (header) => fieldMappings[header] === "phone"
        );
        const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(-10);
        const duplicateMobiles = new Set(result.duplicates.map((dup) => digits(dup.phone)));

        const updatedContacts = parsedContacts.map((contact) => {
          const mobile = phoneHeader ? digits(contact[phoneHeader]) : "";
          return { ...contact, isDuplicate: mobile.length === 10 && duplicateMobiles.has(mobile) };
        });
        setParsedContacts(updatedContacts);
        setDuplicateCheckResult(result);
        setDuplicateCheckError(null);
        const contactIds = parsedContacts.map((_, index) => `contact-${index}`);
        setSelectedContacts(contactIds);
        setActiveStep(1);
      } catch (error: any) {
        setDuplicateCheckError(error?.data?.error || 'Failed to check duplicates');
        console.error('Duplicate check error:', error);
        return;
      }
    }
  };


    const handleSubmit = async () => {
    setError(null);
    if (!assignType) {
      setError('Please select an assign type');
      return;
    }
    // if (selectedUsers.length === 0) {
    //   setError('Please select at least one user');
    //   return;
    // }

     const payload = {
      contacts: parsedContacts.map((contact) => {
        const mappedContact: MappedRow & { isDuplicate?: boolean } = {};
        Object.entries(fieldMappings).forEach(([header, field]) => {
          if (field && contact[header]) {
            mappedContact[field] = String(contact[header]);
          }
        });
        mappedContact.isDuplicate = Boolean(contact.isDuplicate);
        return mappedContact;
      }),
      assignedUsers: selectedUsers.map((user) => user._id).filter((id): id is string => !!id),
      assignType,
      addToPipeline,
      source,
    };

    // Validate contacts before submission
    if (!validateContacts(payload.contacts)) {
      return;
    }
    console.log(payload)
    debugger
    try {
      const result = await bulkImportContacts(payload).unwrap();
      toast.success(result.message);
      if (result.failed.length > 0) {
        result.failed.forEach((f: any) => {
          toast.warning(`Failed to process ${f.contact.email || 'contact'}: ${f.error}`);
        });
      }
      onClose();
    } catch (error: any) {
      toast.error(error?.data?.error || 'Failed to process contacts');
      console.error('Bulk import error:', error);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <>
            {!fileName && <BulkUploadComponent onClose={onClose} onFileUpload={handleFileUpload} />}
            {fileName && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  Uploaded file: {fileName}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  No of contacts: {parsedContacts.length}
                </p>
              </>
            )}
            {headers.length > 0 && (
              <FieldMapper
                headers={headers}
                fieldMappings={fieldMappings}
                onMappingChange={handleMappingChange}
                onNext={handleNext}
                onCancel={onClose}
                onBack={handleBack}
                isFirstStep={activeStep === 0}
                isCheckingDuplicates={isCheckingDuplicates}
                error={duplicateCheckError}
              />
            )}
          </>
        );
      case 1:
        return (
          <BulkUploadAssign
            onClose={onClose}
            selectedContacts={selectedContacts}
            teamMembers={teamMembers?.users || []}
            isLoading={isLoading || isCheckingDuplicates}
            isSubmitLoading={isImporting}
            queryError={queryError}
            selectedUsers={selectedUsers}
            assignType={assignType}
            addToPipeline={addToPipeline}
            source={source}
            onAssignTypeChange={handleAssignTypeChange}
            onSelectUser={handleSelectUser}
            onRemoveUser={handleRemoveUser}
            onPipelineToggle={handlePipelineToggle}
            onSourceChange={handleSourceChange}
            onSubmit={handleSubmit}
            onBack={handleBack}
            error={error || duplicateCheckError}
            duplicateCheckResult={duplicateCheckResult}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4">
      <ol className="items-center w-full flex gap-2">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`flex items-center space-x-2.5 rtl:space-x-reverse ${
              index <= activeStep
                ? 'text-blue-600 dark:text-blue-500 cursor-pointer'
                : 'text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
            onClick={() => handleStepClick(index)}
          >
            <span
              className={`flex items-center justify-center w-8 h-8 border ${
                index <= activeStep
                  ? 'border-blue-600 dark:border-blue-500'
                  : 'border-gray-500 dark:border-gray-400'
              } rounded-full shrink-0`}
            >
              {index + 1}
            </span>
            <span>
              <h3 className="font-medium leading-tight">{step.title}</h3>
              <p className="text-sm hidden md:block">{step.description}</p>
            </span>
            {index < steps.length - 1 && (
              <svg
                className="w-3 h-3 mx-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-6">{renderStepContent()}</div>
    </div>
  );
}