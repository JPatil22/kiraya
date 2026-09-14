import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An icon in a soft accent-tinted square — the app's consistent way of marking a
 * section or card, from the landing pillars through the dashboard and admin.
 */
export function IconTile({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
        className,
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}
