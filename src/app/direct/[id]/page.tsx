import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DirectDetailClient } from "@/components/direct/direct-detail-client";
import { getDirectListingById } from "@/lib/direct";

export const dynamic = "force-dynamic";

export default async function DirectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = getDirectListingById(id);

  if (!listing) {
    notFound();
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Background ambient lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-55 dark:opacity-35 [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_65%,transparent_100%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.15),transparent)] blur-3xl" />
      </div>

      <SiteHeader />

      <main className="relative mx-auto max-w-6xl space-y-8 px-6 py-10">
        <DirectDetailClient listing={listing} />
      </main>
    </div>
  );
}
