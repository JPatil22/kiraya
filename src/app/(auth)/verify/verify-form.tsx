"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOtp, verifyOtp } from "../actions";

export function VerifyForm({ phone }: { phone: string }) {
  const [state, action, pending] = useActionState(verifyOtp, null);
  const [, resendAction, resending] = useActionState(sendOtp, null);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp">6-digit code</Label>
          <Input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="••••••"
            className="text-center text-lg tracking-[0.5em]"
            aria-invalid={state?.error ? true : undefined}
          />
          {state?.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Verifying…" : "Verify & continue"}
        </Button>
      </form>

      <form action={resendAction} className="text-center">
        <input type="hidden" name="phone" value={phone} />
        <Button type="submit" variant="link" size="sm" disabled={resending}>
          {resending ? "Resending…" : "Didn't get it? Resend code"}
        </Button>
      </form>
    </div>
  );
}
