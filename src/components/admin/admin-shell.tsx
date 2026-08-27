import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Health" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/reports", label: "Mismatches" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/duplicates", label: "Duplicates" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/history", label: "Log" },
];

/** Shared chrome for the admin cockpit. */
export function AdminShell({
  active,
  title,
  description,
  children,
}: {
  active: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <nav className="flex flex-wrap gap-1 border-b">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                tab.href === active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {children}
      </main>
    </div>
  );
}
