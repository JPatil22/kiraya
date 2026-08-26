/**
 * Fail the build when configuration is missing, and say everything that is
 * missing at once.
 *
 * The first Vercel deploy of this project returned MIDDLEWARE_INVOCATION_FAILED
 * with no further detail. The cause was ordinary — environment variables not
 * set — but discovering that meant reading library internals, and fixing it
 * one variable at a time would have meant one failed deploy per variable.
 *
 * A build is the right place to find this. NEXT_PUBLIC_* values are inlined at
 * build time anyway, so if they are wrong here they are wrong in the bundle,
 * and failing now costs a build instead of an outage.
 *
 * Runs as `prebuild`, so `npm run build` picks it up with no extra step.
 */

/** Without these there is no application. */
const REQUIRED = [
  ["NEXT_PUBLIC_SUPABASE_URL", "every database call, including the middleware session refresh"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "the browser and server Supabase clients"],
  ["NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG", "resolving which locality this deployment serves"],
];

/**
 * These have working fallbacks, so they must not fail a build — but each one
 * silently removes a feature, and silence is what this file exists to prevent.
 */
const OPTIONAL = [
  ["SUPABASE_SERVICE_ROLE_KEY", "email delivery and open mode; both fail without it"],
  ["NEXT_PUBLIC_SITE_URL", "OAuth return and email links — falls back to VERCEL_URL, which is the deployment's own hostname"],
  ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "Google maps and society search — falls back to OpenStreetMap, which finds 3 Pune societies in 10"],
  ["RESEND_API_KEY", "sending notification emails — the delivery route returns 503 without it"],
  ["KIRAYA_CRON_SECRET", "the delivery route refuses to run at all without it"],
];

/**
 * Open mode in a build is refused by src/lib/open-mode.ts too, but that check
 * fires while webpack is collecting page data — so the message arrives wrapped
 * in module frames, attached to whichever page happened to import it first
 * ("Failed to collect page data for /onboarding/intent"). The reason is in
 * there, several lines up, past a stack trace.
 *
 * `next build` is always a production build, and `next start` would then serve
 * whatever it produced. So there is no build worth making with this on, and it
 * belongs here where it can be said plainly and first.
 */
if (
  process.env.NEXT_PUBLIC_OPEN_MODE === "true" &&
  process.env.KIRAYA_ALLOW_OPEN_MODE_IN_PRODUCTION !==
    "i-understand-this-disables-all-access-control"
) {
  console.error(
    [
      "",
      "  Build stopped. NEXT_PUBLIC_OPEN_MODE is true.",
      "",
      "  Open mode reads the acting role from a cookie and runs every query with",
      "  the service-role key, which bypasses RLS. On a public URL that means",
      "  every visitor is an administrator: approving listings, taking them down,",
      "  suspending brokers, reading every profile.",
      "",
      "  Set NEXT_PUBLIC_OPEN_MODE=false and redeploy. That is the real auth gate",
      "  and what this app is meant to ship with.",
      "",
      "  If this genuinely is a private demo and you accept that anyone with the",
      "  URL is an admin:",
      "    KIRAYA_ALLOW_OPEN_MODE_IN_PRODUCTION=i-understand-this-disables-all-access-control",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const missingRequired = REQUIRED.filter(([name]) => !process.env[name]);
const missingOptional = OPTIONAL.filter(([name]) => !process.env[name]);

if (missingOptional.length > 0) {
  console.warn("\n  Building without:");
  for (const [name, effect] of missingOptional) console.warn(`    ${name}  — ${effect}`);
}

if (missingRequired.length > 0) {
  console.error("\n  Build stopped. These are not set:\n");
  for (const [name, effect] of missingRequired) console.error(`    ${name}  — needed for ${effect}`);
  console.error(
    [
      "",
      "  Set them in the hosting environment and redeploy. NEXT_PUBLIC_ values are",
      "  compiled into the bundle, so changing them in a dashboard without a rebuild",
      "  has no effect.",
      "",
      "  The full list, with what each one breaks, is in docs/DEPLOY.md §1.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

if (missingOptional.length === 0) console.log("  Environment: complete.");
