"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A minimal dropdown menu — a trigger button and a panel that closes on
 * outside-click, Escape, or when something inside it is clicked. No dependency,
 * just enough for the header's account and sandbox menus.
 */
export function Menu({
  trigger,
  triggerClassName,
  children,
  align = "end",
  panelClassName,
  label,
}: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  children: React.ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          triggerClassName,
        )}
      >
        {trigger}
      </button>

      {open ? (
        <div
          role="menu"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("a")) {
              setOpen(false);
            }
          }}
          className={cn(
            "absolute z-50 mt-2 min-w-52 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Shared styling for a link or button that lives inside a Menu panel. */
export const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none";
