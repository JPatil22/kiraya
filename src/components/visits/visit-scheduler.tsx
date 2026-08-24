"use client";

import { useActionState } from "react";
import { CalendarCheck, CalendarClock, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VISIT_STATUS_LABEL } from "@/lib/visit-scheduling";
import { answerVisit, proposeVisit } from "@/app/visits/schedule-actions";
import type { Visit } from "@/types/database";

/**
 * Arranging the viewing, instead of three phone calls to agree a Saturday.
 *
 * Shows one of three things: propose a time, wait for the other side, or the
 * confirmed slot. Deliberately not a calendar widget — a datetime input is
 * enough to agree a time, and anything richer is a project of its own.
 */
export function VisitScheduler({
  contactExchangeId,
  visit,
  viewerId,
}: {
  contactExchangeId: string;
  visit: Visit | null;
  viewerId: string;
}) {
  const [proposeState, propose, proposing] = useActionState(proposeVisit, null);
  const [answerState, answer, answering] = useActionState(answerVisit, null);

  const soonest = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);

  if (visit && (visit.status === "proposed" || visit.status === "confirmed")) {
    const mine = visit.proposed_by === viewerId;
    const when = new Date(visit.scheduled_for);
    const settled = visit.status === "confirmed";

    return (
      <Card className={settled ? "border-success/40" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {settled ? (
              <CalendarCheck className="size-4 text-success" />
            ) : (
              <CalendarClock className="size-4" />
            )}
            {settled ? "Visit confirmed" : VISIT_STATUS_LABEL[visit.status]}
          </CardTitle>
          <CardDescription>
            {when.toLocaleString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            {visit.note ? ` — “${visit.note}”` : null}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2">
          <form action={answer} className="flex flex-wrap gap-2">
            <input type="hidden" name="visitId" value={visit.id} />

            {!settled && !mine ? (
              <Button type="submit" name="status" value="confirmed" size="sm" disabled={answering}>
                <CalendarCheck /> Confirm
              </Button>
            ) : null}

            {!settled && !mine ? (
              <Button
                type="submit"
                name="status"
                value="declined"
                size="sm"
                variant="outline"
                disabled={answering}
              >
                <CalendarX /> Can&apos;t make it
              </Button>
            ) : null}

            <Button
              type="submit"
              name="status"
              value="cancelled"
              size="sm"
              variant="ghost"
              disabled={answering}
            >
              Cancel
            </Button>
          </form>

          {!settled && mine ? (
            <p className="text-xs text-muted-foreground">
              You proposed this — they need to confirm it.
            </p>
          ) : null}

          {answerState?.error ? (
            <p className="text-sm text-destructive">{answerState.error}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Arrange a visit</CardTitle>
        <CardDescription>
          Propose a time rather than playing phone tag. They&apos;ll get a notification and
          can confirm it.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <form action={propose} className="space-y-3">
          <input type="hidden" name="contactExchangeId" value={contactExchangeId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledFor">When</Label>
              <Input
                id="scheduledFor"
                name="scheduledFor"
                type="datetime-local"
                min={soonest}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Anything to add? (optional)</Label>
              <Input id="note" name="note" maxLength={500} placeholder="Coming with my sister" />
            </div>
          </div>

          <Button type="submit" size="sm" disabled={proposing}>
            <CalendarClock /> {proposing ? "Proposing…" : "Propose this time"}
          </Button>
        </form>

        {proposeState?.ok ? (
          <p className="text-sm text-success">{proposeState.ok}</p>
        ) : null}
        {proposeState?.error ? (
          <p className="text-sm text-destructive">{proposeState.error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
