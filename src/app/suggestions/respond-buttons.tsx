"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { respondToSuggestion } from "./actions";

/**
 * Accept / decline / not-relevant. Every outcome is recorded — a declined
 * suggestion is as useful a signal to the broker as an accepted one.
 */
export function RespondButtons({ suggestionId }: { suggestionId: string }) {
  const [state, action, pending] = useActionState(respondToSuggestion, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="suggestionId" value={suggestionId} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="response" value="accepted" size="sm" disabled={pending}>
          <Check /> Interested
        </Button>
        <Button
          type="submit"
          name="response"
          value="declined"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          <X /> Not for me
        </Button>
        <Button
          type="submit"
          name="response"
          value="not_relevant"
          size="sm"
          variant="ghost"
          disabled={pending}
        >
          Doesn&apos;t match what I asked for
        </Button>
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
