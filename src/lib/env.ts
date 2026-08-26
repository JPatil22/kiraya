/**
 * Read a required environment variable, or say which one is missing.
 *
 * Every Supabase client in this codebase was written
 * `process.env.NEXT_PUBLIC_SUPABASE_URL!` — the `!` asserting a value that
 * nothing checks. When the variable is absent the library is handed `undefined`
 * and throws from inside itself, which in middleware surfaces as
 * `MIDDLEWARE_INVOCATION_FAILED` and nothing else: no variable name, no file,
 * no hint that the deploy is simply missing its configuration.
 *
 * That is precisely the failure this hit on its first deploy, and it is the
 * most likely failure on anybody's first deploy. A missing variable is a
 * configuration mistake with an obvious fix; it should read like one.
 *
 * Note this cannot be made lazy or optional for NEXT_PUBLIC_* values. They are
 * inlined at build time, so a missing one is baked into the bundle as
 * `undefined` — the check has to happen where the value is used.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not set. ` +
        `Kiraya cannot start without it — see docs/DEPLOY.md §1 for the full list. ` +
        (name.startsWith("NEXT_PUBLIC_")
          ? "NEXT_PUBLIC_ variables are compiled into the build, so set it and redeploy; " +
            "changing it in the dashboard alone will not take effect."
          : "Set it in the hosting environment and redeploy."),
    );
  }

  return value;
}
