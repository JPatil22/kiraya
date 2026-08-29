"use client";

import { useActionState } from "react";
import { format } from "date-fns";
import { Camera, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoUrl } from "@/lib/photos";
import { slotsWithPhotos, type RoomSlot } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import type { BhkType, PropertyPhoto } from "@/types/database";
import { deletePhoto } from "./actions";
import { QuickAddPhotos } from "./quick-add";

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
 * Adding photos is the Quick-add panel's job — paste/drop/choose several, tag
 * each with a room, upload the batch (0008's one-photo-per-room rule still holds,
 * enforced on write). Everything below is the state view: the photos you have,
 * with a remove on each, and an honest line naming the rooms still missing.
 */
export function PhotoManager({
  propertyId,
  bhk,
  photos,
}: {
  propertyId: string;
  bhk: BhkType;
  photos: PropertyPhoto[];
}) {
  const slots = slotsWithPhotos(bhk, photos);
  const required = slots.filter((s) => s.slot.required);
  const covered = required.filter((s) => s.photo).length;

  const filled = slots.filter((s) => s.photo);
  const missingRequired = required.filter((s) => !s.photo).map((s) => s.slot.label);
  const missingOptional = slots
    .filter((s) => !s.slot.required && !s.photo)
    .map((s) => s.slot.label);

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

      <QuickAddPhotos
        propertyId={propertyId}
        slots={slots.map(({ slot, photo }) => ({
          roomType: slot.roomType,
          roomIndex: slot.roomIndex,
          label: slot.label,
          required: slot.required,
          hasPhoto: Boolean(photo),
        }))}
      />

      {filled.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Your photos
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {filled.map(({ slot, photo }) => (
              <PhotoCard
                key={`${slot.roomType}-${slot.roomIndex}`}
                propertyId={propertyId}
                slot={slot}
                photo={photo!}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {missingRequired.length > 0 || missingOptional.length > 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm">
          {missingRequired.length > 0 ? (
            <p>
              <span className="font-medium">Still needed:</span> {missingRequired.join(", ")}
            </p>
          ) : null}
          {missingOptional.length > 0 ? (
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium">Optional:</span> {missingOptional.join(", ")}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Add these with Quick add above — paste or drop the photo and tag it with the room.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One uploaded photo, with the controls that don't belong in the bulk add:
 * its room label, its capture date and the age warning, and a remove. Replacing
 * a room is re-adding it in Quick-add tagged to the same room — that overwrites.
 */
function PhotoCard({
  propertyId,
  slot,
  photo,
}: {
  propertyId: string;
  slot: RoomSlot;
  photo: PropertyPhoto;
}) {
  const [removeState, remove, removing] = useActionState(deletePhoto, null);
  // The photo carries the date it was added to Kiraya — captured_at is set to
  // the upload date now, and created_at is the fallback for older rows.
  const addedAt = photo.captured_at ?? photo.created_at;

  return (
    <li className="overflow-hidden rounded-xl border">
      {/* eslint-disable-next-line @next/next/no-img-element -- runtime Storage
          host and fixture data: URLs both defeat next/image. */}
      <img
        src={photoUrl(photo.thumbnail_path ?? photo.storage_path)}
        alt={slot.label}
        className="aspect-[4/3] w-full bg-muted object-cover"
      />

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{slot.label}</span>
          <span className="text-xs text-muted-foreground">
            Added {format(new Date(addedAt), "d MMM yyyy")}
          </span>
        </div>

        <form action={remove}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="photoId" value={photo.id} />
          <Button type="submit" size="sm" variant="ghost" disabled={removing}>
            <Trash2 /> Remove
          </Button>
        </form>

        <Feedback state={removeState} />
      </div>
    </li>
  );
}
