import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/admin-guard";
import { DirectAccessManager } from "@/components/admin/direct-access-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Direct Access & In-Person Verification Review — Admin Cockpit",
  description: "Review property owner flat inspections, legal guardianship credentials, and corporate working professionals.",
};

export default async function AdminDirectAccessPage() {
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

  return (
    <AdminShell
      active="/admin/direct-access"
      title="Direct Access & In-Person Verification Review"
      description="Manage in-person property inspections, legal guardianship verification, and corporate professional clearances for Kiraya Direct (Strictly ₹0 Brokerage)."
    >
      <DirectAccessManager />
    </AdminShell>
  );
}
