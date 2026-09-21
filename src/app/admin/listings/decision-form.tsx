"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { BadgeCheck, Camera, Check, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listingMaintenanceAction, reviewListingAction } from "../actions";

function Error({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-sm text-destructive">{message}</p>;
}

/** Approve → live + verification stamp, or reject. */
export function ReviewDecision({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(reviewListingAction, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <Input name="note" placeholder="Note for the audit trail (optional)" maxLength={500} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="decision"
          value="approve"
          size="sm"
          disabled={pending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Check className="size-4 mr-1" /> Approve &amp; publish
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          <Trash2 className="size-3.5 mr-1" /> Delete (Reject)
        </Button>
      </div>
      <Error message={state?.error} />
    </form>
  );
}

/** Re-stamp freshness on a live listing, or archive it. */
export function MaintenanceDecision({
  propertyId,
  photoCount,
}: {
  propertyId: string;
  photoCount?: number;
}) {
  const [showNote, setShowNote] = useState(false);
  const [state, action, pending] = useActionState(listingMaintenanceAction, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="propertyId" value={propertyId} />

      {showNote ? (
        <Input
          name="note"
          placeholder="Reason for takedown / re-verification (optional, e.g. 'No photos')"
          maxLength={500}
          className="text-xs"
          autoFocus
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={`/listings/${propertyId}`}>
            <ExternalLink className="mr-1 size-3.5" /> View
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={`/listings/${propertyId}/photos`}>
            <Camera className="mr-1 size-3.5" /> Photos
            {photoCount !== undefined ? ` (${photoCount})` : ""}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={`/listings/${propertyId}/edit`}>
            <Pencil className="mr-1 size-3.5" /> Edit
          </Link>
        </Button>

        <Button type="submit" name="action" value="verify" size="sm" variant="secondary" className="h-8" disabled={pending}>
          <BadgeCheck className="mr-1 size-3.5" /> Re-verify
        </Button>

        <Button
          type="submit"
          name="action"
          value="takedown"
          size="sm"
          variant="destructive"
          className="h-8 font-medium bg-red-600 hover:bg-red-700 text-white"
          disabled={pending}
        >
          <Trash2 className="mr-1 size-3.5" /> {pending ? "Deleting..." : "Delete listing"}
        </Button>

        {showNote ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => setShowNote(false)}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      <Error message={state?.error} />
    </form>
  );
}
