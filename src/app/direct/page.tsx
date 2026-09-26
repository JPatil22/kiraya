import { ShieldCheck, Sparkles, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { DirectFeedClient } from "@/components/direct/direct-feed-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kiraya Direct — Verified Homes & Flatmates for Working Professionals",
  description:
    "Direct peer-to-peer flatmates and owner rentals in Pune tech hubs. Strictly zero brokerage, verified via LinkedIn & corporate email.",
};

export default function DirectPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Ambient background lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-55 dark:opacity-35 [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_65%,transparent_100%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.15),transparent)] blur-3xl" />
        <div className="animate-aurora absolute -top-24 left-[12%] h-[360px] w-[460px] rounded-full bg-[radial-gradient(closest-side,hsl(270_85%_65%/0.10),transparent)] blur-3xl [animation-delay:-6s]" />
      </div>

      <SiteHeader />

      <main className="relative mx-auto max-w-6xl space-y-6 sm:space-y-8 px-4 sm:px-6 py-6 sm:py-10">
        {/* Editorial Hero Header */}
        <div className="mx-auto max-w-2xl text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Kiraya Direct
          </h1>

          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Peer-to-peer rooms in shared apartments and direct-owner flats across Pune tech hubs (Wakad, Baner, Hinjewadi, Kharadi). Gated behind LinkedIn &amp; work email verification so you never deal with brokers.
          </p>
        </div>

        {/* Client Interactive Feed */}
        <DirectFeedClient />
      </main>
    </div>
  );
}
