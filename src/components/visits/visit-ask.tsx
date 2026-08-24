"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, CircleSlash, HelpCircle, PhoneOff, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { submitVisitFeedback } from "@/app/visits/actions";
import type { VisitOutcome } from "@/types/database";

/**
 * The one question that makes "verified" mean something measured.
 *
 * Four buttons, no typing required. The note is optional and hidden until
 * asked for — the moment this becomes a form, the answer rate collapses, and a
 * low-response trust signal is worse than none because it over-weights whoever
 * had the strongest feelings.
 */

const CHOICES: {
  value: VisitOutcome;
  label: string;
  icon: typeof ThumbsUp;
}[] = [
  { value: "as_described", label: "Yes, as described", icon: ThumbsUp },
  { value: "did_not_match", label: "It didn't match", icon: CircleSlash },
  { value: "unreachable", label: "Couldn't reach them", icon: PhoneOff },
  { value: "did_not_visit", label: "I didn't go", icon: HelpCircle },
];

export function VisitAsk({
  contactExchangeId,
  propertyTitle,
  compact = false,
}: {
  contactExchangeId: string;
  propertyTitle: string | null;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(submitVisitFeedback, null);
  const [showNote, setShowNote] = useState(false);

  if (state?.ok) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        Thanks — that&apos;s what keeps the next person from wasting a trip.
      </p>
    );
  }

  const body = (
    <>
      <form action={action} className="space-y-3">
        <input type="hidden" name="contactExchangeId" value={contactExchangeId} />

        {showNote ? (
          <Textarea
            name="note"
            rows={2}
            maxLength={500}
            placeholder="What was different? (optional)"
          />
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {CHOICES.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="submit"
              name="outcome"
              value={value}
              disabled={pending}
              variant="outline"
              size="sm"
              className="justify-start"
            >
              <Icon className="size-4 shrink-0" /> {label}
            </Button>
          ))}
        </div>
      </form>

      {!showNote ? (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Add a note
        </button>
      ) : null}

      {state?.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">
          Did you visit {propertyTitle ? `"${propertyTitle}"` : "this listing"}?
        </p>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Did you visit {propertyTitle ? `"${propertyTitle}"` : "this listing"}?
        </CardTitle>
        <CardDescription>
          You asked for the number a few days ago. One tap tells the next tenant whether this
          listing is honest — and it&apos;s the only way we find out when one isn&apos;t.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{body}</CardContent>
    </Card>
  );
}
