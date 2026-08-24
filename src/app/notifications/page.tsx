import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  BellOff,
  Bookmark,
  CheckCircle2,
  Flag,
  MessageSquareQuote,
  PhoneCall,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { Button } from "@/components/ui/button";
import { getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getNotifications } from "@/lib/notifications";
import type { NotificationKind } from "@/types/database";
import { markAllRead } from "./actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICON: Record<NotificationKind, typeof Bell> = {
  contact_received: PhoneCall,
  suggestion_received: MessageSquareQuote,
  suggestion_answered: CheckCircle2,
  saved_listing_changed: Bookmark,
  mismatch_reported: Flag,
  listing_reviewed: CheckCircle2,
};

export default async function NotificationsPage() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    const devRole = await getDevRole();
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-8">
          <OpenModeSeedHint role={devRole} />
        </main>
      </div>
    );
  }

  const notifications = await getNotifications(supabase, user.id);
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unread > 0
                ? `${unread} new since you last looked.`
                : "Everything here is something that happened to you, not a digest."}
            </p>
          </div>

          {unread > 0 ? (
            <form action={markAllRead}>
              <Button type="submit" variant="outline" size="sm">
                Mark all read
              </Button>
            </form>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <BellOff className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">Nothing yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              You&apos;ll hear from us when someone asks for your number, when a listing you
              saved changes price, or when a broker suggests something.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {notifications.map((n) => {
              const Icon = ICON[n.kind] ?? Bell;
              const row = (
                <div
                  className={cn(
                    "flex items-start gap-3 p-4",
                    !n.read_at && "bg-primary/5",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      n.read_at ? "text-muted-foreground" : "text-primary",
                    )}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-sm", !n.read_at && "font-medium")}>{n.body}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={n.id}>
                  {n.property_id ? (
                    <Link
                      href={`/listings/${n.property_id}`}
                      className="block transition-colors hover:bg-muted/50"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
