"use client";

import { usePathname } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { Menu, menuItemClass } from "@/components/ui/menu";
import { setDevRole } from "@/app/dev/actions";
import { DEV_ROLES } from "@/lib/open-mode";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

/**
 * Open-mode role switcher, collapsed into a single dropdown so the four
 * identities don't spread four pills across the bar. Still a plain form +
 * server action per role — the sandbox identity remains one cookie.
 */
export function DevRoleSwitcher({ active }: { active: UserRole | null }) {
  const pathname = usePathname() || "/dashboard";

  return (
    <Menu
      label="Switch sandbox role"
      align="end"
      triggerClassName="h-9 rounded-full border border-dashed border-border bg-muted/40 px-3 text-muted-foreground hover:text-foreground"
      trigger={
        <>
          <span className="text-[11px] font-medium uppercase tracking-wider">Sandbox</span>
          <span className="font-semibold capitalize text-foreground">{active ?? "—"}</span>
          <ChevronDown className="size-3.5" />
        </>
      }
    >
      <div className="px-2.5 py-1.5 text-xs text-muted-foreground">Acting as</div>
      {DEV_ROLES.map((role) => (
        <form key={role} action={setDevRole}>
          <input type="hidden" name="returnTo" value={pathname} />
          <button
            type="submit"
            name="role"
            value={role}
            className={cn(menuItemClass, "justify-between capitalize", role === active && "font-medium")}
          >
            {role}
            {role === active ? <Check className="size-4 text-primary" /> : null}
          </button>
        </form>
      ))}
    </Menu>
  );
}
