"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export interface EnquiryPhoto {
  _id: string;
  url: string;
  key?: string | null;
}

interface EnquiryPhotoGalleryProps {
  photos: EnquiryPhoto[];
}

/// The asset photos a seller attached to the valuation form, uploaded
/// straight to S3 by the website. Click a thumbnail to open it full-size with
/// zoom — mirrors the lightbox the website's own form uses to preview them
/// before submission, so a photo looks the same on both sides.
export default function EnquiryPhotoGallery({ photos }: EnquiryPhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Asset Photos
      </h2>

      {photos.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No photos were attached to this enquiry.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((photo, index) => (
            <button
              key={photo._id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label="View photo"
              className="group aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        open={lightboxIndex !== null}
        close={() => setLightboxIndex(null)}
        index={lightboxIndex ?? 0}
        slides={photos.map((photo) => ({ src: photo.url }))}
        plugins={[Zoom]}
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </div>
  );
}
