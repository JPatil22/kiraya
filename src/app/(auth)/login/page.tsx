import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "../actions";

export const dynamic = "force-dynamic";

/**
 * The front door (0030).
 *
 * Phone OTP used to be here and is now dormant — not deleted. It never
 * delivered a code, because an India rollout needs a DLT-registered sender,
 * and it comes back as the step that *verifies* a number somebody has already
 * given us rather than as the way in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 text-center text-lg font-bold tracking-tight">
        किराया <span className="text-muted-foreground">Kiraya</span>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in or create an account</CardTitle>
          <CardDescription>
            One tap with Google. No passwords, no Aadhaar, no documents — ever.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {typeof error === "string" ? error : "Sign-in failed. Try again."}
            </p>
          ) : null}

          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full" size="lg">
              <GoogleMark />
              Continue with Google
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            We&apos;ll ask for your mobile number next. That&apos;s what gets exchanged when
            you enquire about a flat — an Indian rental happens on a phone call, and nobody
            sees your number until you ask for theirs.
          </p>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Browsing listings needs no account at all.{" "}
        <Link href="/listings" className="underline underline-offset-2 hover:text-foreground">
          Have a look first
        </Link>
        .
      </p>
    </main>
  );
}

/** Google's mark, inline — the CSP admits no external image host. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="size-4">
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48Z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71l2.84 2.2c1.66-1.53 2.76-3.79 2.76-6.56Z"
      />
      <path
        fill="#FBBC05"
        d="M3.88 10.78a5.54 5.54 0 0 1-.29-1.78c0-.62.11-1.22.28-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.13-3.74L.96 13.04C2.44 15.98 5.48 18 9 18Z"
      />
    </svg>
  );
}
