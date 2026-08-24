import { TerminalSquare } from "lucide-react";
import { DEV_PHONES } from "@/lib/open-mode";
import type { UserRole } from "@/types/database";

/**
 * Shown when open mode is on but the dev identities don't exist in the database
 * yet. Better than a redirect to a login screen that can't work.
 */
export function OpenModeSeedHint({ role }: { role: UserRole | null }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4">
      <TerminalSquare className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-2 text-sm">
        <p className="font-medium">Open mode is on, but the sandbox isn&apos;t seeded.</p>
        <p className="text-muted-foreground">
          No profile found for{" "}
          <span className="font-mono">{role ? DEV_PHONES[role] : "the dev identities"}</span>.
          Apply the migrations and create the dev users and sample listings:
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs">
          npm run db:push{"\n"}npm run db:seed
        </pre>
      </div>
    </div>
  );
}
