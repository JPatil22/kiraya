import { format } from "date-fns";
import { ArrowRight, BadgeCheck, CalendarClock, IndianRupee, Settings2 } from "lucide-react";
import { formatUpdateField, formatUpdateValue, updateAuthor } from "@/lib/history";
import { cn } from "@/lib/utils";
import type { PropertyUpdate, UpdateKind, UserRole } from "@/types/database";

const KIND_ICON: Record<UpdateKind, typeof IndianRupee> = {
  price: IndianRupee,
  availability: CalendarClock,
  verification: BadgeCheck,
  terms: Settings2,
  other: Settings2,
};

/**
 * The listing's change log. Every row here was written by the database trigger
 * in migration 0003 — the app cannot add to or edit this list, which is exactly
 * what makes it worth showing a tenant.
 */
export function UpdateTimeline({
  updates,
  postedBy,
  postedByRole,
}: {
  updates: PropertyUpdate[];
  postedBy: string;
  postedByRole: UserRole | null;
}) {
  if (updates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has changed since this listing was posted.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {updates.map((u) => {
        const Icon = KIND_ICON[u.kind] ?? Settings2;
        const isVerification = u.kind === "verification";

        return (
          <li key={u.id} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                isVerification ? "border-success/40 bg-success/10" : "bg-muted",
              )}
            >
              <Icon className={cn("size-3.5", isVerification && "text-success")} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{formatUpdateField(u.field)}</span>{" "}
                {isVerification ? (
                  <span className="text-muted-foreground">re-confirmed</span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
                    <span className="text-muted-foreground line-through">
                      {formatUpdateValue(u.field, u.old_value)}
                    </span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="font-medium tabular-nums">
                      {formatUpdateValue(u.field, u.new_value)}
                    </span>
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {format(new Date(u.created_at), "d MMM yyyy")} · by{" "}
                {updateAuthor(u.changed_by, postedBy, postedByRole)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
