import Link from "next/link";
import { ArrowLeft, CheckCircle, ExternalLink, Info, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Extension Ingest Test Harness — Kiraya",
  description: "Test page mimicking a Facebook rental post for Kiraya Chrome Ingestor testing",
};

// High quality, direct JPEG images suitable for testing room tagging and discarding.
const SAMPLE_PHOTOS = [
  {
    label: "Living Room",
    url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80",
  },
  {
    label: "Master Bedroom",
    url: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1200&auto=format&fit=crop&q=80",
  },
  {
    label: "Modular Kitchen",
    url: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80",
  },
  {
    label: "Bathroom",
    url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&auto=format&fit=crop&q=80",
  },
  {
    label: "Balcony / View",
    url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&auto=format&fit=crop&q=80",
  },
  {
    label: "Floor Plan / Junk Photo (Candidate for Discard)",
    url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&auto=format&fit=crop&q=80",
  },
];

const MOCK_POST_TEXT = `Spacious 2 BHK available for rent in Baner, Pune near Balewadi High Street.
Society: Rohan Leher, Baner.
Rent: 28,000 / month, Deposit: 60,000.
Semi-furnished flat with modular kitchen, wardrobes in both bedrooms, lights, fans, geyser and 2 private balconies.
Covered car parking and lift backup available.
Working professionals or families preferred.
Immediate possession available.
Brokerage: 15,000.
Contact: Rajesh Sharma - 9823012345`;

export default function TestExtensionPage() {
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/admin/listings">
              <ArrowLeft className="size-4 mr-1" /> Back to Admin Review Queue
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">Admin Dashboard</Link>
            </Button>
          </div>
        </div>

        {/* Instructions banner */}
        <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
              <Sparkles className="size-4 text-indigo-600" />
              How to Test the Chrome Extension End-to-End
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-indigo-950/80 dark:text-indigo-200/80">
            <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>
                <strong>Load the Extension:</strong> Go to{" "}
                <code className="rounded bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 text-xs">
                  chrome://extensions
                </code>
                , enable <em>Developer mode</em>, click <em>Load unpacked</em>, and pick the{" "}
                <code className="rounded bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 text-xs">
                  chrome-extension
                </code>{" "}
                folder.
              </li>
              <li>
                <strong>Check Popup Settings:</strong> Click the Kiraya extension icon in Chrome toolbar.
                Ensure Endpoint is{" "}
                <code className="rounded bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 text-xs">
                  http://localhost:3000/api/ingest
                </code>{" "}
                and Secret Key is{" "}
                <code className="rounded bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 text-xs">
                  my-super-secret-key
                </code>
                .
              </li>
              <li>
                <strong>Extract:</strong> On this page (or a real Facebook post), click the floating{" "}
                <span className="font-semibold text-rose-600">🎯 Extract Listing</span> button at the bottom-right, then click anywhere on the post text below.
              </li>
              <li>
                <strong>Review &amp; Decide:</strong> Once the button says{" "}
                <em>&quot;Sent ✅ — Open Review ↗&quot;</em>, click it (or visit{" "}
                <Link href="/admin/listings" className="underline font-semibold">
                  /admin/listings
                </Link>
                ) to inspect the extracted text, tag photos into rooms, discard junk photos, and either{" "}
                <strong>Publish</strong> (approve to live) or <strong>Discard</strong> (reject).
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Mock Facebook Post */}
        <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden" role="article">
          {/* Post Header */}
          <div className="p-4 border-b flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                RS
              </div>
              <div>
                <h2 className="font-semibold text-sm">Rajesh Sharma</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>Pune Real Estate &amp; Flatmates</span> · <span>3 hrs ago</span> · 🌐
                </p>
              </div>
            </div>
            <span className="text-xs rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-muted-foreground font-medium">
              Mock Facebook Post
            </span>
          </div>

          {/* Post Body (Text to click) */}
          <div className="p-5 text-sm whitespace-pre-line leading-relaxed text-slate-800 dark:text-slate-200 select-text cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            {MOCK_POST_TEXT}
          </div>

          {/* Photo Gallery Grid */}
          <div className="border-t p-4 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Attached Photos ({SAMPLE_PHOTOS.length})
              </span>
              <span className="text-xs text-muted-foreground">
                Tip: The extension collects these thumbnails automatically
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SAMPLE_PHOTOS.map((photo, i) => (
                <div
                  key={i}
                  className="group relative aspect-[4/3] rounded-lg overflow-hidden border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.label}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-2 py-0.5 text-[11px] text-white font-medium backdrop-blur-sm">
                    {photo.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fallback Direct Testing Card */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" />
              Alternative: Direct API Ingest Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              You can also test the full backend ingestion and admin review state machine directly via terminal without touching the browser extension:
            </p>
            <pre className="rounded bg-slate-100 dark:bg-slate-900 p-3 font-mono text-xs overflow-x-auto text-foreground">
              node scripts/test-ingest-e2e.mjs
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
