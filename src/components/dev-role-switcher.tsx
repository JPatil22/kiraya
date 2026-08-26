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
    <form
      action={setDevRole}
      className="hidden items-center gap-2 rounded-full border border-dashed bg-muted/40 py-1 pl-3 pr-1 md:flex"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Sandbox
      </span>
      {/* A segmented control on its own dashed ground: this is a development
          affordance and should not read as product navigation. */}
      <div className="flex items-center gap-0.5 rounded-full bg-background/80 p-0.5">
        {DEV_ROLES.map((role) => (
          <button
            key={role}
            type="submit"
            name="role"
            value={role}
            aria-pressed={role === active}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              "text-muted-foreground hover:text-foreground",
              role === active && "bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {role}
          </button>
        ))}
      </div>
    </form>
  );
}
