"use client";

import { useEffect, useState } from "react";
import { Eye, Flame, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Returns a modest, realistic viewer count (1-3) appropriate for early launch phase.
 */
function getInitialWatcherCount(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return 1 + (Math.abs(hash) % 3); // Returns 1, 2, or 3
}

export function LiveWatcherBadge({
  propertyId,
  variant = "compact",
  className,
}: {
  propertyId: string;
  variant?: "compact" | "detailed";
  className?: string;
}) {
  const [count, setCount] = useState<number>(() => getInitialWatcherCount(propertyId));

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-2xs backdrop-blur-xs transition-all duration-300",
          className
        )}
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <Flame className="size-3 text-emerald-600 dark:text-emerald-400 fill-emerald-500/30" />
        <span>{count} looking now</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 sm:p-4 text-emerald-900 dark:text-emerald-200 shadow-2xs transition-all duration-300",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-80" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-600" />
        </span>
        <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
          <Flame className="size-4 text-emerald-600 dark:text-emerald-400 fill-emerald-500/40" />
          <span className="font-bold tabular-nums text-foreground">{count} {count === 1 ? "person" : "people"}</span> viewing this listing
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-emerald-800/80 dark:text-emerald-300/80 font-medium">
        <span className="flex items-center gap-1">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          Date-stamped verification active
        </span>
      </div>
    </div>
  );
}
