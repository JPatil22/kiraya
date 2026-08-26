"use client";

import { useActionState, useRef, useState } from "react";
import { format } from "date-fns";
import { Camera, CheckCircle2, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { downscaleImage, thumbnailImage } from "@/lib/downscale";
import { ACCEPTED_MIME, photoAgeWarning, photoUrl } from "@/lib/photos";
import { slotsWithPhotos, type RoomSlot } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import type { BhkType, PropertyPhoto } from "@/types/database";
import { deletePhoto, uploadPhotos } from "./actions";

function Feedback({ state }: { state: { error?: string; ok?: string } | null }) {
  if (state?.error) {
    return (
      <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p className="rounded-md border border-success/50 bg-success/10 px-3 py-2 text-sm">
        {state.ok}
      </p>
    );
  }
  return null;
}

/**
 * One card per room the listing owes, rather than a pile of uploads.
 *
 * This is the whole point of 0008: a tenant looking at a 2BHK should see the
 * hall, the kitchen, both bedrooms and the bathroom — not eight angles of the
 * living room and nothing else.
 */
export function PhotoManager({
  propertyId,
  bhk,
  photos,
  lastVerifiedAt,
}: {
  propertyId: string;
  bhk: BhkType;
  photos: PropertyPhoto[];
  lastVerifiedAt: string | null;
}) {
  const slots = slotsWithPhotos(bhk, photos);
  const required = slots.filter((s) => s.slot.required);
  const covered = required.filter((s) => s.photo).length;
  const optional = slots.filter((s) => !s.slot.required);

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4 text-sm",
          covered === required.length ? "border-success/50 bg-success/10" : "bg-muted/40",
        )}
      >
        {covered === required.length ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
        ) : (
          <Camera className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">
            {covered} of {required.length} rooms photographed
          </p>
          <p className="text-muted-foreground">
            {covered === required.length
              ? "Every room a tenant expects to see is covered."
              : "Tenants see which rooms are missing. A gap reads as something being hidden."}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Rooms in this {bhk === "4plus" ? "4+ BHK" : bhk.toUpperCase()}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {required.map(({ slot, photo }) => (
            <SlotCard
              key={`${slot.roomType}-${slot.roomIndex}`}
              propertyId={propertyId}
              slot={slot}
              photo={photo}
              lastVerifiedAt={lastVerifiedAt}
            />
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Optional
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {optional.map(({ slot, photo }) => (
            <SlotCard
              key={`${slot.roomType}-${slot.roomIndex}`}
              propertyId={propertyId}
              slot={slot}
              photo={photo}
              lastVerifiedAt={lastVerifiedAt}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SlotCard({
  propertyId,
  slot,
  photo,
  lastVerifiedAt,
}: {
  propertyId: string;
  slot: RoomSlot;
  photo: PropertyPhoto | null;
  lastVerifiedAt: string | null;
}) {
  const [uploadState, upload, uploading] = useActionState(uploadPhotos, null);
  // True while a chosen photo is being downscaled in the browser.
  const [preparing, setPreparing] = useState(false);
  const [removeState, remove, removing] = useActionState(deletePhoto, null);
  const formRef = useRef<HTMLFormElement>(null);
  // The card-sized copy rides along in the same submit via a hidden file input
  // whose contents we set programmatically (0033).
  const thumbRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const warning = photo ? photoAgeWarning(photo.captured_at, lastVerifiedAt) : null;
  const inputId = `file-${slot.roomType}-${slot.roomIndex}`;

  return (
    <li className={cn("overflow-hidden rounded-xl border", !photo && "border-dashed")}>
      {photo ? (
        // Runtime Storage host and fixture data: URLs both defeat next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl(photo.thumbnail_path ?? photo.storage_path)}
          alt={slot.label}
          className="aspect-[4/3] w-full bg-muted object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted/40">
          <Camera className="size-8 text-muted-foreground" />
        </div>
      )}

      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{slot.label}</span>
          {photo ? (
            <span className="text-xs text-muted-foreground">
              {photo.captured_at
                ? `Taken ${format(new Date(photo.captured_at), "d MMM yyyy")}`
                : "Date not given"}
            </span>
          ) : (
            <Badge variant={slot.required ? "warning" : "outline"}>
              {slot.required ? "Missing" : "Not added"}
            </Badge>
          )}
        </div>

        {warning ? <p className="text-xs text-warning">{warning.label}</p> : null}

        <form ref={formRef} action={upload} className="space-y-2">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="roomType" value={slot.roomType} />
          <input type="hidden" name="roomIndex" value={slot.roomIndex} />
          {/* Populated in onChange, submitted with the form. Hidden, never
              user-touched — the poster picks one file, not two (0033). */}
          <input ref={thumbRef} name="thumbnail" type="file" className="hidden" tabIndex={-1} aria-hidden="true" />

          <Label htmlFor={inputId} className="sr-only">
            {photo ? `Replace the ${slot.label} photo` : `Add a ${slot.label} photo`}
          </Label>
          <Input
            id={inputId}
            name="photo"
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            className="text-xs"
            // Shrink before the bytes leave the phone: a 4000px camera photo
            // is several megabytes of the poster's mobile data going up, and
            // every tenant's coming back down.
            onChange={async (event) => {
              const input = event.currentTarget;
              const picked = input.files?.[0];
              if (!picked) return;

              // The submit button waits on this. Without that, picking a file
              // and hitting Add immediately would upload the original —
              // silently, and only on slow phones, which is the worst kind of
              // bug to find later.
              setPreparing(true);
              try {
                // Full image for the detail page, thumbnail for the feed —
                // produced from the same picked file in one pass.
                const [smaller, thumb] = await Promise.all([
                  downscaleImage(picked),
                  thumbnailImage(picked),
                ]);
                if (smaller !== picked) {
                  const carrier = new DataTransfer();
                  carrier.items.add(smaller);
                  input.files = carrier.files;
                }
                // Replace whatever a previous pick left in the hidden input:
                // an empty file list when the thumbnail couldn't be made, so a
                // stale thumbnail never rides along with a new photo.
                if (thumbRef.current) {
                  const carrier = new DataTransfer();
                  if (thumb) carrier.items.add(thumb);
                  thumbRef.current.files = carrier.files;
                }
              } finally {
                setPreparing(false);
              }
            }}
          />
          <Input
            name="capturedAt"
            type="date"
            max={today}
            aria-label="When was this taken?"
            className="text-xs"
          />

          <Button
            type="submit"
            size="sm"
            variant={photo ? "outline" : "default"}
            disabled={uploading || preparing}
          >
            <ImagePlus />{" "}
            {preparing ? "Preparing…" : uploading ? "Uploading…" : photo ? "Replace" : "Add photo"}
          </Button>
        </form>

        <Feedback state={uploadState} />
        <Feedback state={removeState} />

        {photo ? (
          <form action={remove}>
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="photoId" value={photo.id} />
            <Button type="submit" size="sm" variant="ghost" disabled={removing}>
              <Trash2 /> Remove
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
