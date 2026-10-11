"use client";

import { useRef } from "react";
import { toast } from "react-toastify";
import { uploadImageToS3 } from "@/helpers/uploadToS3";
import ShortSpinnerDark from "@/components/ui/loaders/ShortSpinnerDark";

export interface EnquiryPhotoState {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  remoteUrl?: string;
  key?: string;
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

interface PhotosStepProps {
  photos: EnquiryPhotoState[];
  onPhotosChange: (updater: (prev: EnquiryPhotoState[]) => EnquiryPhotoState[]) => void;
}

export default function PhotosStep({ photos, onPhotosChange }: PhotosStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (photoId: string, file: File) => {
    try {
      const uploaded = await uploadImageToS3(file, "enquiries");
      onPhotosChange((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, status: "done", remoteUrl: uploaded.url, key: uploaded.key } : p
        )
      );
    } catch {
      onPhotosChange((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: "error" } : p)));
    }
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const accepted: EnquiryPhotoState[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`${file.name} is larger than 8MB and was skipped`);
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      });
    }
    if (accepted.length === 0) return;
    onPhotosChange((prev) => [...prev, ...accepted]);
    accepted.forEach((photo) => uploadPhoto(photo.id, photo.file));
  };

  const handleRemove = (photoId: string) => {
    onPhotosChange((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleRetry = (photo: EnquiryPhotoState) => {
    onPhotosChange((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "uploading" } : p)));
    uploadPhoto(photo.id, photo.file);
  };

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Upload Photos</h3>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Optional — front/back photos help the team value the asset faster.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-brand-700"
      >
        Click to add photos
      </button>

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
              {photo.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <ShortSpinnerDark />
                </div>
              )}
              {photo.status === "error" && (
                <button
                  type="button"
                  onClick={() => handleRetry(photo)}
                  className="absolute inset-0 flex items-center justify-center bg-error-500/70 text-xs font-medium text-white"
                >
                  Failed — tap to retry
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(photo.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
