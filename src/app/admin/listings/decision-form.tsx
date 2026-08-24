"use client";

import { useActionState } from "react";
import { BadgeCheck, Check, Trash2, X } from "lucide-react";
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
        <Button type="submit" name="decision" value="approve" size="sm" disabled={pending}>
          <Check /> Approve &amp; verify
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          <X /> Reject
        </Button>
      </div>
      <Error message={state?.error} />
    </form>
  );
}

/** Re-stamp freshness on a live listing, or archive it. */
export function MaintenanceDecision({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(listingMaintenanceAction, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="action" value="verify" size="sm" disabled={pending}>
          <BadgeCheck /> Re-verify
        </Button>
        <Button
          type="submit"
          name="action"
          value="takedown"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          <Trash2 /> Take down
        </Button>
      </div>
      <Error message={state?.error} />
    </form>
  );
}
