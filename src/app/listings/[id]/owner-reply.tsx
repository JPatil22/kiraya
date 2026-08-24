"use client";

import { useActionState } from "react";
import { MessageSquareReply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replyToReport } from "./actions";

/**
 * The poster's side of a mismatch report.
 *
 * A public warning badge with only the accusation behind it is half a story.
 * This doesn't clear the report — an admin still decides that — it just means
 * the person it's about is on the record.
 */
export function OwnerReply({
  reportId,
  existing,
}: {
  reportId: string;
  existing: string | null;
}) {
  const [state, action, pending] = useActionState(replyToReport, null);

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="reportId" value={reportId} />
      <Textarea
        name="response"
        rows={2}
        maxLength={1000}
        defaultValue={existing ?? ""}
        placeholder="What actually happened? Tenants and the admin reviewing this both see it."
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          <MessageSquareReply /> {existing ? "Update reply" : "Reply"}
        </Button>
        {state?.ok ? (
          <span className="text-xs text-success">Saved.</span>
        ) : null}
        {state?.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
