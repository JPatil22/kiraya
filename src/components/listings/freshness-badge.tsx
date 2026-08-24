import { BadgeCheck, CalendarX2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { freshnessLabel } from "@/lib/listings";
import { cn } from "@/lib/utils";

/**
 * The headline trust signal: when was this listing last confirmed real?
 * Stale listings are never hidden — they're labelled, so the tenant decides.
 */
export function FreshnessBadge({
  daysSinceVerified,
  isStale,
  className,
}: {
  daysSinceVerified: number | null;
  isStale: boolean;
  className?: string;
}) {
  const { label, tone } = freshnessLabel(daysSinceVerified, isStale);
  const Icon = tone === "fresh" ? BadgeCheck : CalendarX2;

  return (
    <Badge
      variant={tone === "fresh" ? "success" : "warning"}
      className={cn("gap-1", className)}
    >
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}
