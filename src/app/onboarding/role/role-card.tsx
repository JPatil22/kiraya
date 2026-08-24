"use client";

import { useFormStatus } from "react-dom";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoleCard({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors",
        "hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:opacity-60",
      )}
    >
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>
      </div>
      {pending ? (
        <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
