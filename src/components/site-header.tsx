import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { AccountMenu, type NavItem } from "@/components/account-menu";
import { canPost, getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE, OPEN_MODE_IN_PRODUCTION } from "@/lib/open-mode";
import { getUnreadCount } from "@/lib/notifications";
import { hasIntent } from "@/lib/suggestions";

/** Shared top bar. Renders auth-aware actions without blocking the page. */
export async function SiteHeader() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  // In open mode the switcher, not the profile row, is the source of truth for
  // the acting role — so it still works before the sandbox has been seeded.
  const role = OPEN_MODE ? await getDevRole() : (user?.role ?? null);

  // The badge is the only thing that makes the six trigger-fed flows visible
  // without opening a page to look for them.
  const unread = user ? await getUnreadCount(supabase, user.id) : 0;

  // Since 0024 anyone may hold an intent, so the inbox link follows the intent
  // rather than the role. Tenants short-circuit — theirs is the tenant flow
  // whether or not they have filled it in yet.
  const showSuggestions = user
    ? role === "tenant" || (await hasIntent(supabase, user.id))
    : false;

  // Secondary destinations live in the account menu, not spread across the bar.
  const menuItems: NavItem[] = [];
  if (user) menuItems.push({ label: "Dashboard", href: "/dashboard" });
  if (user) menuItems.push({ label: "Saved", href: "/shortlist" });
  if (showSuggestions) menuItems.push({ label: "Suggestions", href: "/suggestions" });
  if (role === "broker") menuItems.push({ label: "Tenant demand", href: "/broker/intents" });
  if (role === "admin") menuItems.push({ label: "Admin", href: "/admin" });

  return (
    <>
      {/*
        Only reachable with the explicit escape hatch set, and loud on purpose:
        a private demo that quietly became the production URL is exactly the
        situation nobody notices until a stranger finds the role switcher.
      */}
      {OPEN_MODE_IN_PRODUCTION ? (
        <div className="bg-destructive px-4 py-1.5 text-center text-xs font-medium text-destructive-foreground">
          Open mode is on in a production build — everyone who loads this page is an
          administrator. Set NEXT_PUBLIC_OPEN_MODE=false.
        </div>
      ) : null}

    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        {/* Brand + the one primary destination. */}
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <BrandMark />
          </Link>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/listings">Listings</Link>
          </Button>
        </div>

        {/* Action · utilities · you — everything else is grouped, not spread. */}
        <nav className="flex items-center gap-2">
          {canPost(role) ? (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/listings/new">Post a property</Link>
            </Button>
          ) : null}

          {user ? (
            <Button asChild variant="ghost" size="icon" className="relative size-9 rounded-full">
              <Link
                href="/notifications"
                aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
              >
                <Bell className="size-4" />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            </Button>
          ) : null}

          {OPEN_MODE ? <DevRoleSwitcher active={role} /> : null}

          {user ? (
            <AccountMenu items={menuItems} roleLabel={role} showSignOut={!OPEN_MODE} />
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
    </>
  );
}
