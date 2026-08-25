"use client";

import { useActionState } from "react";
import { Mail, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveEmail, type EmailPrefState } from "@/app/notifications/actions";

/**
 * Where notices go when nobody is looking at the page (0026).
 *
 * Deliberately sitting on the activity page rather than in a settings screen:
 * this is the one moment somebody is looking at the things they would have been
 * emailed, which is the only moment the offer means anything.
 */
export function EmailPreference({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<EmailPrefState, FormData>(saveEmail, null);

  return (
    <form action={action} className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        {current ? (
          <Mail className="size-4 shrink-0 text-primary" />
        ) : (
          <MailX className="size-4 shrink-0 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {current ? "These also go to your inbox" : "Get these by email too"}
        </p>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {current
          ? "Clear the box and save to stop them. Your phone number stays how you sign in either way."
          : "Optional, and never how you sign in — a listing going stale is no use as news you only see when you happen to visit."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          type="email"
          name="email"
          defaultValue={current ?? ""}
          placeholder="you@example.com"
          aria-label="Email address for notifications"
          className="w-full sm:w-72"
        />
        <Button type="submit" size="sm" variant={current ? "outline" : "default"} disabled={pending}>
          {pending ? "Saving…" : current ? "Update" : "Send them to me"}
        </Button>
      </div>

      {state?.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
      {state?.ok ? <p className="mt-2 text-sm text-success">{state.ok}</p> : null}
    </form>
  );
}
