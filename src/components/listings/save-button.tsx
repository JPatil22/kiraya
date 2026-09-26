"use client";

import { useActionState } from "react";
import { Bookmark } from "lucide-react";
import { toggleShortlist } from "@/app/shortlist/actions";
import { cn } from "@/lib/utils";

/**
 * Save toggle. Rendered as an overlay on the card rather than inside it — the
 * whole card is a link, and a button nested in an anchor is both invalid and
 * unusable with a keyboard.
 */
export function SaveButton({
  propertyId,
  saved,
  variant = "overlay",
}: {
  propertyId: string;
  saved: boolean;
  variant?: "overlay" | "inline";
}) {
  const [state, action, pending] = useActionState(toggleShortlist, null);

  // Optimistic-ish: trust the action's answer once it has one, else the prop.
  const isSaved = state?.saved ?? saved;
  const label = isSaved ? "Saved — tap to remove" : "Save this listing";

  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="propertyId" value={propertyId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={label}
        title={label}
        className={cn(
          "flex items-center gap-1.5 rounded-md border text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          variant === "overlay"
            ? "size-8.5 rounded-full bg-background/80 dark:bg-stone-900/80 backdrop-blur-md border border-border/50 shadow-sm hover:bg-background hover:scale-105 active:scale-95 justify-center"
            : "px-3 py-1.5 hover:bg-muted",
          isSaved && "border-primary text-primary bg-primary/10 dark:bg-primary/20",
          pending && "opacity-60",
        )}
      >
        <Bookmark className={cn("size-4", isSaved && "fill-current text-primary")} />
        {variant === "inline" ? (isSaved ? "Saved" : "Save") : null}
      </button>
    </form>
  );
}
