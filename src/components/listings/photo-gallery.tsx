"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CameraOff, ChevronLeft, ChevronRight, Clock, Maximize2, X } from "lucide-react";
import { photoAgeWarning, photoUrl } from "@/lib/photos";
import { slotsWithPhotos } from "@/lib/rooms";
import type { BhkType, PropertyPhoto } from "@/types/database";

/**
 * The listing's rooms, in the order a tenant would walk them, each labelled
 * with when it was taken — and missing rooms flagged.
 * Includes interactive full-screen lightbox to view crisp photos up close.
 */
export function PhotoGallery({
  photos,
  bhk,
  lastVerifiedAt,
}: {
  photos: PropertyPhoto[];
  bhk: BhkType;
  lastVerifiedAt: string | null;
}) {
  const slots = slotsWithPhotos(bhk, photos);
  const shown = slots.filter((s) => s.photo);
  const missing = slots.filter((s) => s.slot.required && !s.photo);

  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activePhotoIndex === null) return;
      if (e.key === "Escape") setActivePhotoIndex(null);
      if (e.key === "ArrowLeft") {
        setActivePhotoIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : shown.length - 1));
      }
      if (e.key === "ArrowRight") {
        setActivePhotoIndex((prev) => (prev !== null && prev < shown.length - 1 ? prev + 1 : 0));
      }
    },
    [activePhotoIndex, shown.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (shown.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        <CameraOff className="mt-0.5 size-5 shrink-0" />
        <p>
          <span className="font-medium text-foreground">No photos of any room yet.</span>{" "}
          We&apos;d rather show you an honest cost breakdown than a stock image.
        </p>
      </div>
    );
  }

  const [cover, ...rest] = shown;

  return (
    <div className="space-y-3">
      {/* Hero Cover Frame */}
      <Frame
        label={cover.slot.label}
        photo={cover.photo!}
        lastVerifiedAt={lastVerifiedAt}
        priority
        onClick={() => setActivePhotoIndex(0)}
      />

      {/* Grid of Remaining Room Photos */}
      {rest.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rest.map(({ slot, photo }, idx) => (
            <li key={`${slot.roomType}-${slot.roomIndex}`}>
              <Frame
                label={slot.label}
                photo={photo!}
                lastVerifiedAt={lastVerifiedAt}
                compact
                onClick={() => setActivePhotoIndex(idx + 1)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Missing Required Room Warning */}
      {missing.length > 0 ? (
        <p className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <span className="font-medium">Not shown:</span>{" "}
          {missing.map((m) => m.slot.label.toLowerCase()).join(", ")}. Ask to see{" "}
          {missing.length === 1 ? "it" : "them"} before you commit.
        </p>
      ) : null}

      {/* Interactive Full-Screen Lightbox Modal */}
      {activePhotoIndex !== null && shown[activePhotoIndex] ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 transition-all"
          onClick={() => setActivePhotoIndex(null)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-5xl flex-col items-center justify-center overflow-hidden rounded-2xl bg-black/40 border border-white/10 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Lightbox Bar */}
            <div className="flex w-full items-center justify-between px-4 py-2 text-white">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {shown[activePhotoIndex].slot.label}
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white/80 font-mono">
                  {activePhotoIndex + 1} / {shown.length}
                </span>
              </div>
              <button
                onClick={() => setActivePhotoIndex(null)}
                className="rounded-full p-2 text-white/80 hover:bg-white/20 hover:text-white transition"
                aria-label="Close photo viewer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Main Lightbox Image */}
            <div className="relative flex max-h-[75vh] w-full items-center justify-center overflow-hidden py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(shown[activePhotoIndex].photo!.storage_path)}
                alt={shown[activePhotoIndex].slot.label}
                className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>

            {/* Navigation Controls */}
            {shown.length > 1 ? (
              <>
                <button
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev !== null && prev > 0 ? prev - 1 : shown.length - 1
                    )
                  }
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white backdrop-blur-md hover:bg-black/90 transition shadow-md"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-6" />
                </button>

                <button
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev !== null && prev < shown.length - 1 ? prev + 1 : 0
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white backdrop-blur-md hover:bg-black/90 transition shadow-md"
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Frame({
  label,
  photo,
  lastVerifiedAt,
  compact,
  priority,
  onClick,
}: {
  label: string;
  photo: PropertyPhoto;
  lastVerifiedAt: string | null;
  compact?: boolean;
  priority?: boolean;
  onClick: () => void;
}) {
  const warning = photoAgeWarning(photo.captured_at, lastVerifiedAt);

  return (
    <figure
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-card transition hover:border-primary/50 hover:shadow-md"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl(photo.storage_path)}
        alt={label}
        loading={priority ? "eager" : "lazy"}
        className={
          compact
            ? "aspect-square w-full bg-muted object-cover transition duration-300 group-hover:scale-105"
            : "aspect-[16/10] w-full bg-muted object-cover transition duration-300 group-hover:scale-102"
        }
      />

      {/* Expand Hover Badge */}
      <div className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition duration-200 group-hover:opacity-100 backdrop-blur-xs">
        <Maximize2 className="size-3.5" />
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          {photo.captured_at
            ? format(new Date(photo.captured_at), "d MMM yyyy")
            : "date not given"}
        </span>
        {warning ? <span className="text-warning">· {warning.label}</span> : null}
      </figcaption>
    </figure>
  );
}
