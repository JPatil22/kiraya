/**
 * Shown the instant a listing card is clicked. Without it the detail page's
 * queries run with no feedback at all, and a slow request reads as a dead link.
 *
 * Deliberately contains NO async server components — not even <SiteHeader />,
 * which queries the database. A Suspense fallback that has to await anything
 * cannot paint immediately, which defeats the entire point of having one.
 */
export default function LoadingListing() {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="text-lg font-bold tracking-tight">
            किराया <span className="text-muted-foreground">Kiraya</span>
          </span>
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl animate-pulse space-y-6 px-6 py-8">
        <div className="h-8 w-2/3 rounded bg-muted" />
        <div className="h-4 w-1/3 rounded bg-muted" />

        <div className="flex gap-2">
          <div className="h-6 w-28 rounded-full bg-muted" />
          <div className="h-6 w-24 rounded-full bg-muted" />
          <div className="h-6 w-32 rounded-full bg-muted" />
        </div>

        <div className="aspect-[16/10] w-full rounded-xl bg-muted" />

        <div className="space-y-3 rounded-xl border p-6">
          <div className="h-5 w-48 rounded bg-muted" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>

        <div className="h-40 rounded-xl border" />
      </main>
    </div>
  );
}
