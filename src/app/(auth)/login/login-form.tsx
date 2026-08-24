"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOtp } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(sendOtp, null);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Mobile number</Label>
        <div className="flex items-center rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
          <span className="px-3 text-sm text-muted-foreground">+91</span>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            maxLength={10}
            placeholder="98765 43210"
            className="border-0 shadow-none focus-visible:ring-0"
            aria-invalid={state?.error ? true : undefined}
          />
        </div>
        {state?.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending code…" : "Send OTP"}
      </Button>

      {process.env.NODE_ENV !== "production" ? (
        <p className="text-center text-xs text-muted-foreground">
          Dev: try <span className="font-mono">9000000001</span> · code{" "}
          <span className="font-mono">123456</span>
        </p>
      ) : null}
    </form>
  );
}
