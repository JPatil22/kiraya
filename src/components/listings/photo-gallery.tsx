import { format } from "date-fns";
import { CameraOff, Clock } from "lucide-react";
import { photoAgeWarning, photoUrl } from "@/lib/photos";
import { slotsWithPhotos } from "@/lib/rooms";
import type { BhkType, PropertyPhoto } from "@/types/database";

/**
 * The listing's rooms, in the order a tenant would walk them, each labelled
 * with when it was taken — and, crucially, the rooms that are MISSING.
 *
 * An absent bedroom photo on a 2BHK is information. Silently showing four
 * pictures of the hall is how every other portal hides the bad room.
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
      <Frame
        label={cover.slot.label}
        photo={cover.photo!}
        lastVerifiedAt={lastVerifiedAt}
        priority
      />

      {rest.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rest.map(({ slot, photo }) => (
            <li key={`${slot.roomType}-${slot.roomIndex}`}>
              <Frame label={slot.label} photo={photo!} lastVerifiedAt={lastVerifiedAt} compact />
            </li>
          ))}
        </ul>
      ) : null}

      {missing.length > 0 ? (
        <p className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <span className="font-medium">Not shown:</span>{" "}
          {missing.map((m) => m.slot.label.toLowerCase()).join(", ")}. Ask to see{" "}
          {missing.length === 1 ? "it" : "them"} before you commit.
        </p>
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
}: {
  label: string;
  photo: PropertyPhoto;
  lastVerifiedAt: string | null;
  compact?: boolean;
  priority?: boolean;
}) {
  const warning = photoAgeWarning(photo.captured_at, lastVerifiedAt);

  return (
    <figure className="overflow-hidden rounded-xl border">
      {/* eslint-disable-next-line @next/next/no-img-element -- Storage lives on a
          runtime-configured host, and fixture mode serves data: URLs; neither
          works with next/image's build-time remotePatterns. */}
      <img
        src={photoUrl(photo.storage_path)}
        alt={label}
        loading={priority ? "eager" : "lazy"}
        className={
          compact
            ? "aspect-square w-full bg-muted object-cover"
            : "aspect-[16/10] w-full bg-muted object-cover"
        }
      />
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs">
        <span className="font-medium">{label}</span>
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
