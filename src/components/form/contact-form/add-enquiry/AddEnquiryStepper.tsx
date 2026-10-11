"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { AssetCategory } from "@prisma/client";
import Button from "@/components/ui/button/Button";
import ShortSpinnerDark from "@/components/ui/loaders/ShortSpinnerDark";
import { useCreateContactMutation } from "@/app/redux/api/contactApi";
import { useGetPipelineByIdQuery } from "@/app/redux/api/pipelineApi";
import { isDetailsStepValid, type EnquiryDetailsValues } from "@/app/lib/enquiry/categoryFieldSchema";
import CategoryStep from "./CategoryStep";
import DetailsStep from "./DetailsStep";
import PhotosStep, { type EnquiryPhotoState } from "./PhotosStep";
import ContactStep, { type ContactFormState } from "./ContactStep";
import CrmDetailsStep, { type CrmDetailsFormState } from "./CrmDetailsStep";

interface AddEnquiryStepperProps {
  onClose: () => void;
}

/// Mirrors the website's 4-step valuation form (Category, Details, Photos,
/// Contact — see D:\voltx src/components/ValuationForm.tsx) plus one extra
/// step for the fields only the CRM needs (pipeline stage, source, tags,
/// notes), which the public form has no equivalent of.
const STEPS = ["Category", "Details", "Photos", "Contact", "CRM Details"];

const EMPTY_DETAILS: EnquiryDetailsValues = {
  jewelleryType: "",
  brand: "",
  metalWeight: "",
  carat: "",
  shapeCut: "",
  condition: "",
  certificateAvailable: "",
  certificateLab: "",
  purchaseYear: "",
  description: "",
};

const EMPTY_CONTACT: ContactFormState = {
  name: "",
  mobile: "",
  city: "",
  email: "",
  preferredContact: "",
};

const EMPTY_CRM: CrmDetailsFormState = {
  source: "",
  stage: "",
  tags: [],
  notes: "",
};

export default function AddEnquiryStepper({ onClose }: AddEnquiryStepperProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [category, setCategory] = useState<AssetCategory | null>(null);
  const [details, setDetails] = useState<EnquiryDetailsValues>(EMPTY_DETAILS);
  const [photos, setPhotos] = useState<EnquiryPhotoState[]>([]);
  const [contact, setContact] = useState<ContactFormState>(EMPTY_CONTACT);
  const [crmDetails, setCrmDetails] = useState<CrmDetailsFormState>(EMPTY_CRM);
  const [error, setError] = useState<string | null>(null);

  const { data: pipelineData } = useGetPipelineByIdQuery(process.env.NEXT_PUBLIC_DEFAULT_PIPELINE || "");
  const stages = useMemo(() => pipelineData?.pipeline?.stages || [], [pipelineData]);
  const [createContact, { isLoading }] = useCreateContactMutation();

  // Default to the pipeline's first stage once it loads, without clobbering
  // a stage the user already picked.
  useEffect(() => {
    if (crmDetails.stage || stages.length === 0) return;
    const first = [...stages].sort(
      (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0)
    )[0];
    if (first?._id) {
      setCrmDetails((prev) => ({ ...prev, stage: first._id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages]);

  const canProceed = useMemo(() => {
    switch (activeStep) {
      case 0:
        return category !== null;
      case 1:
        return category !== null && isDetailsStepValid(category, details);
      case 2:
        return !photos.some((p) => p.status === "uploading");
      case 3:
        return Boolean(
          contact.name.trim() && contact.mobile.trim() && contact.city.trim() && contact.preferredContact
        );
      default:
        return true;
    }
  }, [activeStep, category, details, photos, contact]);

  const goNext = () => {
    if (!canProceed) return;
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setActiveStep((s) => Math.max(s - 1, 0));
  const goToStep = (index: number) => {
    if (index <= activeStep) setActiveStep(index);
  };

  const updateDetails = (key: string, value: string) =>
    setDetails((prev) => ({ ...prev, [key]: value }));
  const updateContact = <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) =>
    setContact((prev) => ({ ...prev, [key]: value }));
  const updateCrm = <K extends keyof CrmDetailsFormState>(key: K, value: CrmDetailsFormState[K]) =>
    setCrmDetails((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!category) return;
    setError(null);
    try {
      const response = await createContact({
        name: contact.name.trim(),
        mobile: contact.mobile.trim(),
        email: contact.email.trim() || undefined,
        city: contact.city.trim() || undefined,
        preferredContact: contact.preferredContact || undefined,
        category,
        jewelleryType: details.jewelleryType || undefined,
        brand: details.brand || undefined,
        metalWeight: details.metalWeight || undefined,
        carat: details.carat || undefined,
        shapeCut: details.shapeCut || undefined,
        condition: details.condition || undefined,
        certificateAvailable: details.certificateAvailable || undefined,
        certificateLab: details.certificateLab || undefined,
        purchaseYear: details.purchaseYear || undefined,
        description: details.description || undefined,
        photos: photos
          .filter((p) => p.status === "done" && p.remoteUrl)
          .map((p) => ({ url: p.remoteUrl as string, key: p.key })),
        notes: crmDetails.notes || undefined,
        tags: crmDetails.tags.length ? crmDetails.tags : undefined,
        source: crmDetails.source || undefined,
        stageId: crmDetails.stage || undefined,
      }).unwrap();
      console.log("Enquiry created:", response.contact);
      toast.success("Enquiry added successfully");
      onClose();
    } catch (err) {
      const message =
        (err as { data?: { error?: string } })?.data?.error || "Failed to create enquiry";
      setError(message);
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <CategoryStep value={category} onChange={setCategory} />;
      case 1:
        return category ? (
          <DetailsStep category={category} values={details} onChange={updateDetails} />
        ) : null;
      case 2:
        return <PhotosStep photos={photos} onPhotosChange={setPhotos} />;
      case 3:
        return <ContactStep values={contact} onChange={updateContact} />;
      case 4:
        return <CrmDetailsStep values={crmDetails} stages={stages} onChange={updateCrm} />;
      default:
        return null;
    }
  };

  const isLastStep = activeStep === STEPS.length - 1;

  return (
    <div>
      <h2 className="mb-4 font-semibold text-gray-800 modal-title text-theme-xl dark:text-white/90 lg:text-2xl">
        Add New Enquiry
      </h2>

      <ol className="mb-6 flex items-center gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((label, index) => (
          <li key={label} className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => goToStep(index)}
              disabled={index > activeStep}
              className={`flex items-center gap-1.5 ${
                index <= activeStep
                  ? "cursor-pointer text-brand-600 dark:text-brand-400"
                  : "cursor-not-allowed text-gray-400 dark:text-gray-500"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  index <= activeStep ? "border-brand-500" : "border-gray-300 dark:border-gray-700"
                }`}
              >
                {index + 1}
              </span>
              <span className="hidden text-sm font-medium sm:inline">{label}</span>
            </button>
            {index < STEPS.length - 1 && (
              <span className="mx-2 h-px w-4 shrink-0 bg-gray-300 dark:bg-gray-700" />
            )}
          </li>
        ))}
      </ol>

      <div className="min-h-[260px]">{renderStep()}</div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-6 flex justify-between">
        <Button type="button" variant="outline" onClick={activeStep === 0 ? onClose : goBack}>
          {activeStep === 0 ? "Cancel" : "Back"}
        </Button>
        {isLastStep ? (
          <Button type="button" variant="primary" disabled={isLoading} onClick={handleSubmit}>
            {isLoading ? <ShortSpinnerDark /> : "Save Enquiry"}
          </Button>
        ) : (
          <Button type="button" variant="primary" disabled={!canProceed} onClick={goNext}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
