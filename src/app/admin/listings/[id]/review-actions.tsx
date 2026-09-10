"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewFromPageAction } from "@/app/admin/actions";

/**
 * Approve → live + verified, or reject — from the review page. On success it
 * redirects back to the queue (the listing has left "awaiting review"), so this
 * only ever renders an error inline.
 */
export function ReviewPageActions({
  propertyId,
  warnings,
}: {
  propertyId: string;
  warnings: string[];
}) {
  const [state, action, pending] = useActionState(reviewFromPageAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="propertyId" value={propertyId} />

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <p className="font-medium">Before you publish — worth a look:</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">
            You can still approve — these are flags, not blocks.
          </p>
        </div>
      ) : null}

      <Input name="note" placeholder="Note for the audit trail (optional)" maxLength={500} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          <Check /> Approve &amp; publish
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="outline"
          disabled={pending}
        >
          <X /> Reject
        </Button>
      </div>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
