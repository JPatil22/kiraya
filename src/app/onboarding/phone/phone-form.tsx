"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePhone, type PhoneState } from "../actions";

export function PhoneForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<PhoneState, FormData>(savePhone, null);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Mobile number</Label>
        <div className="flex items-center rounded-md border border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
          <span className="px-3.5 text-sm text-muted-foreground">+91</span>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            maxLength={10}
            placeholder="98765 43210"
            defaultValue={initial.replace(/^\+91/, "")}
            className="border-0 shadow-none focus-visible:ring-0"
            aria-invalid={state?.error ? true : undefined}
          />
        </div>
        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>

      <p className="text-xs text-muted-foreground">
        We can&apos;t text you a confirmation code yet, so this stays marked as unverified
        until we can. It still has to be a real number you answer — an enquiry that reaches
        nobody counts against your listing.
      </p>
    </form>
  );
}
