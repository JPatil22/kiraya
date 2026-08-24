"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BHK_OPTIONS, labelFor } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import type { Property } from "@/types/database";
import { sendSuggestion } from "./actions";

/**
 * Compose a suggestion against one tenant intent. The listing dropdown is
 * limited to the broker's own live listings — there is no free-text "DM me for
 * details" path, which is the entire point of MVP4.
 */
export function SuggestForm({
  intentId,
  listings,
  alreadySuggested,
}: {
  intentId: string;
  listings: Property[];
  alreadySuggested: Set<string>;
}) {
  const [state, action, pending] = useActionState(sendSuggestion, null);
  const [open, setOpen] = useState(false);

  const available = listings.filter((l) => !alreadySuggested.has(l.id));

  if (state?.ok) {
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="size-4" /> Suggestion sent.
      </p>
    );
  }

  if (listings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have no live listings to suggest yet.
      </p>
    );
  }

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You&apos;ve already suggested all your live listings to this tenant.
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Send /> Suggest a listing
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <input type="hidden" name="tenantIntentId" value={intentId} />

      <div className="space-y-2">
        <Label htmlFor={`property-${intentId}`}>Which of your live listings?</Label>
        <Select name="propertyId" defaultValue={available[0]?.id}>
          <SelectTrigger id={`property-${intentId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {available.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.title} · {labelFor(BHK_OPTIONS, l.bhk)} ·{" "}
                {formatINR(l.rent + l.maintenance_monthly)}/mo
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`message-${intentId}`}>Note to the tenant (optional)</Label>
        <Textarea
          id={`message-${intentId}`}
          name="message"
          rows={2}
          maxLength={500}
          placeholder="e.g. slightly over your budget but includes maintenance and parking."
        />
      </div>

      {state?.error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send suggestion"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
