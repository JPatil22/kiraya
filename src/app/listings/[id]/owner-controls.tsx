"use client";

import { useActionState } from "react";
import { CheckCircle2, CircleCheck, CirclePause, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvailabilityStatus } from "@/types/database";
import { confirmListing } from "./actions";

/**
 * The poster's maintenance panel — the one thing this product could not do
 * before 0009.
 *
 * Freshness is the whole promise, and until now only an admin could restamp it,
 * so every listing was guaranteed to rot into "stale". These three buttons are
 * the same statement in three flavours — *I looked just now, and this is the
 * state* — so each one restamps the clock as a side effect. The owner never has
 * to press two things to tell the truth once.
 */

const CHOICES: {
  value: AvailabilityStatus;
  label: string;
  hint: string;
  icon: typeof CircleCheck;
}[] = [
  {
    value: "available",
    label: "Still available",
    hint: "Re-verifies the listing and keeps it in the feed.",
    icon: CircleCheck,
  },
  {
    value: "on_hold",
    label: "On hold",
    hint: "Stays visible, marked as not currently taking enquiries.",
    icon: CirclePause,
  },
  {
    value: "rented",
    label: "Rented out",
    hint: "Leaves the feed straight away. The page and its history stay up.",
    icon: KeyRound,
  },
];

export function OwnerControls({
  propertyId,
  availability,
  daysSinceVerified,
  isStale,
}: {
  propertyId: string;
  availability: AvailabilityStatus;
  daysSinceVerified: number | null;
  isStale: boolean;
}) {
  const [state, action, pending] = useActionState(confirmListing, null);

  // Deliberately the same number the FreshnessBadge shows. Deriving it here
  // instead put "19 days ago" next to a badge reading "18 days ago" — one
  // rounds, the other floors, and both were on screen at once.
  const confirmedAgo =
    daysSinceVerified === null
      ? null
      : daysSinceVerified === 0
        ? "today"
        : `${daysSinceVerified} day${daysSinceVerified === 1 ? "" : "s"} ago`;

  return (
    <Card className={isStale ? "border-warning/60" : undefined}>
      <CardHeader>
        <CardTitle className="text-base">Is this still accurate?</CardTitle>
        <CardDescription>
          {confirmedAgo ? (
            <>
              You last confirmed this {confirmedAgo}.{" "}
              {isStale
                ? "Tenants are seeing it marked stale until you confirm again."
                : "Tenants can see exactly when."}
            </>
          ) : (
            "This listing has never been confirmed, so tenants see it as unverified."
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <form action={action} className="grid gap-2 sm:grid-cols-3">
          <input type="hidden" name="propertyId" value={propertyId} />
          {CHOICES.map(({ value, label, hint, icon: Icon }) => (
            <Button
              key={value}
              type="submit"
              name="availability"
              value={value}
              disabled={pending}
              variant={value === availability ? "default" : "outline"}
              className="h-auto flex-col items-start gap-0.5 py-2.5 text-left whitespace-normal"
              title={hint}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Icon className="size-4 shrink-0" /> {label}
              </span>
              <span className="text-xs font-normal opacity-80">{hint}</span>
            </Button>
          ))}
        </form>

        {state?.ok ? (
          <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            {state.ok}
          </p>
        ) : null}

        {state?.error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Every confirmation is recorded with your name and the time, and shows on the public
          change history below. That&apos;s what makes it worth something to a tenant.
        </p>
      </CardContent>
    </Card>
  );
}
