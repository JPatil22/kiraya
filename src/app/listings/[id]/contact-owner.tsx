"use client";

import { useActionState, useState } from "react";
import { MessageSquare, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { telHref } from "@/lib/contact";
import type { UserRole } from "@/types/database";
import { requestContact } from "./actions";

/**
 * The step the product was missing: getting from a listing to a phone call.
 *
 * Once unlocked it renders the number itself rather than a "contact" button
 * that opens something else — the whole point is that the tenant leaves this
 * page able to dial, and knows the poster can see who asked.
 */
export function ContactOwner({
  propertyId,
  posterName,
  posterRole,
  unlocked,
  phone,
  contactName = null,
}: {
  propertyId: string;
  posterName: string | null;
  posterRole: UserRole | null;
  unlocked: boolean;
  phone: string | null;
  /**
   * The name that goes with `phone` when the listing was seeded from an outside
   * source — the real broker, not the seeded identity that posted the row. Only
   * meaningful once unlocked, since that's the only time a number is shown.
   */
  contactName?: string | null;
}) {
  const [state, action, pending] = useActionState(requestContact, null);
  const [showMessage, setShowMessage] = useState(false);

  const who = posterName ?? (posterRole === "broker" ? "the broker" : "the owner");
  const revealedWho = contactName ?? who;

  if (unlocked || state?.ok) {
    const href = telHref(phone);
    return (
      <Card className="border-success/40">
        <CardHeader>
          <CardTitle className="text-base">Contact {revealedWho}</CardTitle>
          <CardDescription>
            They can see that you asked, and on which listing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {phone ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xl font-semibold tabular-nums">{phone}</span>
              {href ? (
                <Button asChild size="sm">
                  <a href={href}>
                    <Phone /> Call
                  </a>
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No number on file for {revealedWho}. That&apos;s unusual — an admin can help.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Check the last-verified date above before you travel. If what you find doesn&apos;t
            match, report it — that&apos;s what keeps the next tenant from wasting the trip.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Interested in this one?</CardTitle>
        <CardDescription>
          Get {who}&apos;s number, and they get yours — so whoever calls first, it works.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <form action={action} className="space-y-3">
          <input type="hidden" name="propertyId" value={propertyId} />

          {showMessage ? (
            <div className="space-y-2">
              <Label htmlFor="message">Anything to say? (optional)</Label>
              <Textarea
                id="message"
                name="message"
                rows={3}
                maxLength={500}
                placeholder="Hi — could I see it this Saturday morning?"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              <Phone /> {pending ? "Getting the number…" : "Get contact details"}
            </Button>
            {!showMessage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowMessage(true)}
              >
                <MessageSquare /> Add a message
              </Button>
            ) : null}
          </div>
        </form>

        {state?.error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Your number is shared with {who} only, and only for this listing. Every exchange is
          recorded on both sides.
        </p>
      </CardContent>
    </Card>
  );
}
