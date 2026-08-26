import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { canPost, getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getUnreadCount } from "@/lib/notifications";
import { hasIntent } from "@/lib/suggestions";
import { signOut } from "@/app/(auth)/actions";

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

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="rounded-md text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          किराया <span className="text-muted-foreground">Kiraya</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/listings">Listings</Link>
          </Button>

          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/shortlist">Saved</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="relative">
                <Link href="/notifications" aria-label={
                  unread > 0 ? `Activity, ${unread} unread` : "Activity"
                }>
                  <Bell className="size-4" />
                  {unread > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </Link>
              </Button>
            </>
          ) : null}

          {showSuggestions ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/suggestions">Suggestions</Link>
            </Button>
          ) : null}

          {role === "broker" ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/broker/intents">Tenant demand</Link>
            </Button>
          ) : null}

          {role === "admin" ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">Admin</Link>
            </Button>
          ) : null}

          {canPost(role) ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/listings/new">Post a property</Link>
            </Button>
          ) : null}

          {OPEN_MODE ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <DevRoleSwitcher active={role} />
            </>
          ) : user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              {role ? (
                <Badge variant="secondary" className="hidden sm:inline-flex capitalize">
                  {role}
                </Badge>
              ) : null}
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
