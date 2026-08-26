import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingStep } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Where Google sends people back (0030).
 *
 * Supabase hands over a `code`; exchanging it is what actually writes the
 * session cookies, so nothing is signed in until this runs. Then the same
 * routing decision `verifyOtp` makes: send people to whichever onboarding step
 * they still owe, or to the dashboard.
 *
 * Errors land here too — a cancelled consent screen comes back with
 * `error=access_denied` and no code — and they go to /login with a readable
 * reason rather than a blank page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthError)}`, url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=Sign-in%20was%20cancelled.", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * An authorisation code is single-use, so a second exchange of the same one
   * fails with `flow_state_already_used`. That is not necessarily a failed
   * sign-in — it is what a refresh, a back button, or the callback being
   * requested twice looks like, and the first attempt may well have succeeded.
   *
   * So the session is the authority here, not the exchange result: if one
   * exists, the person is signed in and being sent back to /login with an error
   * would be a lie about their own state.
   */
  if (error && !user) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  let step: OnboardingStep = "role";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step")
      .eq("id", user.id)
      .maybeSingle();
    step = profile?.onboarding_step ?? "role";
  }

  return NextResponse.redirect(
    new URL(step === "done" ? "/dashboard" : `/onboarding/${step}`, url.origin),
  );
}
