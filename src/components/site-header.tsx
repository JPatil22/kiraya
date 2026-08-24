import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { canPost, getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { signOut } from "@/app/(auth)/actions";

/** Shared top bar. Renders auth-aware actions without blocking the page. */
export async function SiteHeader() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  // In open mode the switcher, not the profile row, is the source of truth for
  // the acting role — so it still works before the sandbox has been seeded.
  const role = OPEN_MODE ? await getDevRole() : (user?.role ?? null);

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          किराया <span className="text-muted-foreground">Kiraya</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/listings">Listings</Link>
          </Button>

          {user ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/shortlist">Saved</Link>
            </Button>
          ) : null}

          {role === "tenant" ? (
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
