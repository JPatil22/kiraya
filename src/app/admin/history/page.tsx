import { format } from "date-fns";
import { History, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { requireAdminPage } from "@/lib/admin-guard";
import { getModerationHistory } from "@/lib/history";
import type { ModerationKind } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * The moderation log.
 *
 * `moderation_actions` has been written on every admin decision since 0005 and
 * nothing has ever read it — so an admin could not see what another admin had
 * done, or review their own call. In a product whose entire argument is that
 * changes are attributable, the moderators were the one unaccountable party.
 */

const KIND_LABEL: Record<ModerationKind, string> = {
  approve: "Approved a listing",
  reject: "Rejected a listing",
  verify: "Re-verified a listing",
  takedown: "Took a listing down",
  suspend_user: "Suspended an account",
  reinstate_user: "Reinstated an account",
  resolve_report: "Resolved a mismatch report",
  dismiss_report: "Dismissed a mismatch report",
};

const DESTRUCTIVE: ModerationKind[] = ["reject", "takedown", "suspend_user"];

export default async function AdminHistoryPage() {
  const ctx = await requireAdminPage();
  if (!ctx.ok) {
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-8">
          <OpenModeSeedHint role={ctx.devRole} />
        </main>
      </div>
    );
  }

  const actions = await getModerationHistory(ctx.supabase);

  return (
    <AdminShell
      active="/admin/history"
      title="Moderation log"
      description="Every admin decision, in order. Written automatically by the RPCs in 0005 — not editable by anyone, including whoever made the call."
    >
      {actions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">No moderation actions yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Approving, rejecting, re-verifying, taking down or suspending will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border">
          {actions.map((a) => (
            <li key={a.id} className="flex items-start gap-3 p-4">
              <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {KIND_LABEL[a.kind] ?? a.kind}
                  </span>
                  {DESTRUCTIVE.includes(a.kind) ? (
                    <Badge variant="destructive">irreversible</Badge>
                  ) : null}
                </div>
                {a.note ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    &ldquo;{a.note}&rdquo;
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {a.target_table} · {a.target_id.slice(0, 8)} ·{" "}
                  {format(new Date(a.created_at), "d MMM yyyy, HH:mm")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
