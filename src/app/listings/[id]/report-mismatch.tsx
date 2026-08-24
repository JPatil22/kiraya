"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Flag } from "lucide-react";
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
import { MISMATCH_OPTIONS } from "@/lib/constants";
import { reportMismatch } from "./actions";

/**
 * Tenant-facing "this didn't match" form. Collapsed by default — reporting is
 * the exception, not the main action on the page.
 */
export function ReportMismatch({
  propertyId,
  alreadyReported,
}: {
  propertyId: string;
  alreadyReported: boolean;
}) {
  const [state, action, pending] = useActionState(reportMismatch, null);
  const [open, setOpen] = useState(false);

  if (alreadyReported || state?.ok) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <p>
          <span className="font-medium">Thanks — your report is on file.</span> An admin
          reviews it, and once two people report the same listing everyone sees a warning.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Flag /> Something didn&apos;t match
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-lg border p-4">
      <input type="hidden" name="propertyId" value={propertyId} />

      <div className="space-y-2">
        <Label htmlFor="type">What was wrong?</Label>
        <Select name="type" defaultValue="price_higher">
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MISMATCH_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">What happened? (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          placeholder="e.g. the owner quoted ₹22,000 plus brokerage on the call."
        />
      </div>

      {state?.error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Submit report"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Reports are reviewed by a Kiraya admin. Two open reports on the same listing show a
        warning to every tenant who views it.
      </p>
    </form>
  );
}
