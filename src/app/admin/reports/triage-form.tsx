"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveReportAction } from "../actions";

/**
 * Resolve = the tenant was right, act on the listing too.
 * Dismiss  = it didn't hold up. Either way the report stops counting toward
 * the public warning, so this is the lever that clears a badge.
 */
export function TriageForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(resolveReportAction, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="reportId" value={reportId} />
      <Input name="note" placeholder="What did you find? (optional)" maxLength={500} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="resolve" size="sm" disabled={pending}>
          <Check /> Resolve — it was true
        </Button>
        <Button
          type="submit"
          name="decision"
          value="dismiss"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          <X /> Dismiss
        </Button>
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
