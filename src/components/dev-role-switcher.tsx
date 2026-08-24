import { headers } from "next/headers";
import { setDevRole } from "@/app/dev/actions";
import { DEV_PATH_HEADER, DEV_ROLES } from "@/lib/open-mode";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

/**
 * Open-mode role switcher. Plain form + server action — no client JS — so the
 * whole sandbox identity is one cookie you can also clear by hand.
 */
export async function DevRoleSwitcher({ active }: { active: UserRole | null }) {
  // Set by the middleware; the action redirects here so the new cookie is read
  // on a fresh request.
  const returnTo = (await headers()).get(DEV_PATH_HEADER) ?? "/dashboard";

  return (
    <form action={setDevRole} className="hidden items-center gap-1 md:flex">
      <input type="hidden" name="returnTo" value={returnTo} />
      <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
        Acting as
      </span>
      <div className="flex overflow-hidden rounded-md border">
        {DEV_ROLES.map((role) => (
          <button
            key={role}
            type="submit"
            name="role"
            value={role}
            aria-pressed={role === active}
            className={cn(
              "px-2.5 py-1 text-xs capitalize transition-colors",
              "border-r last:border-r-0 hover:bg-muted",
              role === active && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {role}
          </button>
        ))}
      </div>
    </form>
  );
}
