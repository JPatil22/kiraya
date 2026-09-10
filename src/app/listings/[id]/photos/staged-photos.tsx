"use client";

import { useActionState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoUrl } from "@/lib/photos";
import { assignStagedPhoto, discardStagedPhoto } from "./actions";
import type { SlotOption } from "./quick-add";

/**
 * The "from the source post" pile — photos the Chrome ingestor scraped and
 * dropped into ingest_photos (0037), waiting for a human to say which room each
 * one shows. Nothing here is a listing photo yet: assigning tags it into a room
 * (and it joins the room-coverage count); discarding throws it away. This is the
 * deliberate seam that keeps a scraped, unlabelled photo from faking coverage.
 */

const keyOf = (roomType: string, roomIndex: number) => `${roomType}:${roomIndex}`;

export type StagedItem = {
  id: string;
  storagePath: string;
  thumbnailPath: string | null;
};

export function StagedPhotos({
  propertyId,
  staged,
  slots,
}: {
  propertyId: string;
  staged: StagedItem[];
  slots: SlotOption[];
}) {
  if (staged.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-4 dark:border-amber-400/30 dark:bg-amber-950/20">
      <h2 className="text-sm font-medium">
        {staged.length} photo{staged.length === 1 ? "" : "s"} from the source post
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        These came from the original post. Nobody has said which room each shows, so they
        don&apos;t count toward coverage yet. Tag each with its room to add it — or discard the
        ones that aren&apos;t rooms (floor plans, watermarks, duplicates).
      </p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {staged.map((item) => (
          <StagedCard key={item.id} propertyId={propertyId} item={item} slots={slots} />
        ))}
      </ul>
    </div>
  );
}

function StagedCard({
  propertyId,
  item,
  slots,
}: {
  propertyId: string;
  item: StagedItem;
  slots: SlotOption[];
}) {
  const [assignState, assign, assigning] = useActionState(assignStagedPhoto, null);
  const [discardState, discard, discarding] = useActionState(discardStagedPhoto, null);
  const busy = assigning || discarding;
  const error = assignState?.error ?? discardState?.error;

  return (
    <li className="overflow-hidden rounded-xl border bg-background">
      {/* eslint-disable-next-line @next/next/no-img-element -- Storage host and
          fixture data: URLs both defeat next/image. */}
      <img
        src={photoUrl(item.thumbnailPath ?? item.storagePath)}
        alt="Scraped photo awaiting a room"
        className="aspect-[4/3] w-full bg-muted object-cover"
      />

      <div className="space-y-2 p-3">
        <form action={assign} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="stagedId" value={item.id} />
          <select
            name="slotKey"
            required
            disabled={busy}
            defaultValue=""
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
          >
            <option value="" disabled>
              — pick room —
            </option>
            {slots.map((s) => (
              <option key={keyOf(s.roomType, s.roomIndex)} value={keyOf(s.roomType, s.roomIndex)}>
                {s.label}
                {s.hasPhoto ? " (replaces current)" : ""}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={busy}>
            <Check /> Add
          </Button>
        </form>

        <form action={discard}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="stagedId" value={item.id} />
          <Button type="submit" size="sm" variant="ghost" disabled={busy}>
            <Trash2 /> Discard
          </Button>
        </form>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
