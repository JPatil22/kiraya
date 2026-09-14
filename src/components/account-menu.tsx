"use client";

import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Menu, menuItemClass } from "@/components/ui/menu";
import { signOut } from "@/app/(auth)/actions";

export type NavItem = { label: string; href: string };

/**
 * The account / "everything else" dropdown. Pulls the secondary destinations
 * (Dashboard, Saved, Suggestions…) and Sign out off the top bar so it isn't a
 * wall of links — the bar keeps the brand, Listings, the one action, and this.
 */
export function AccountMenu({
  items,
  roleLabel,
  showSignOut,
}: {
  items: NavItem[];
  roleLabel?: string | null;
  showSignOut?: boolean;
}) {
  return (
    <Menu
      label="Account menu"
      align="end"
      triggerClassName="h-9 rounded-full border border-border bg-background pl-1 pr-2 hover:bg-accent"
      trigger={
        <>
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="size-4" />
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </>
      }
    >
      {roleLabel ? (
        <div className="px-2.5 py-1.5 text-xs text-muted-foreground">
          Acting as <span className="font-medium capitalize text-foreground">{roleLabel}</span>
        </div>
      ) : null}
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={menuItemClass}>
          {it.label}
        </Link>
      ))}
      {showSignOut ? (
        <>
          <div className="my-1 h-px bg-border" />
          <form action={signOut}>
            <button type="submit" className={menuItemClass}>
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </>
      ) : null}
    </Menu>
  );
}
