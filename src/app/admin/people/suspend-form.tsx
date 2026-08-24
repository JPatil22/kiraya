"use client";

import { useActionState } from "react";
import { Ban, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setSuspendedAction } from "../actions";

/**
 * Suspension is the enforcement behind the transparency rules: a suspended
 * poster can't create listings (0002) or send suggestions (0004) — the DB
 * policies check `is_suspended`, so it bites regardless of the UI.
 */
export function SuspendForm({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const [state, action, pending] = useActionState(setSuspendedAction, null);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="suspended" value={suspended ? "false" : "true"} />
      <Button
        type="submit"
        size="sm"
        variant={suspended ? "outline" : "destructive"}
        disabled={pending}
      >
        {suspended ? (
          <>
            <Undo2 /> Reinstate
          </>
        ) : (
          <>
            <Ban /> Suspend
          </>
        )}
      </Button>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
