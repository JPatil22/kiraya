"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { indianMobileSchema, otpSchema, toE164 } from "@/lib/validators";
import type { OnboardingStep } from "@/types/database";

export type AuthState = { error: string } | null;

/**
 * Google sign-in (0030) — the way in, as of now.
 *
 * Phone OTP below is intact and dormant, exactly as it has been under open
 * mode. It never delivered a code because an India rollout needs a
 * DLT-registered sender; Google needs nothing, costs nothing, and cannot be
 * abused by scripting an endpoint that has to be public.
 *
 * What it does NOT do is replace the phone number. Google proves an email, and
 * email is free to create in bulk. Posting a listing or unlocking somebody's
 * contact details still requires a number — see /onboarding/phone.
 */
export async function signInWithGoogle() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Must be an absolute URL, and must be registered in Supabase under
      // Authentication → URL Configuration → Redirect URLs.
      redirectTo: `${siteUrl()}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data?.url) {
    // Nothing to render an error into — the button posts and navigates away —
    // so send them back to /login with a reason in the URL.
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Could not reach Google.")}`);
  }

  redirect(data.url);
}

/**
 * The absolute origin OAuth has to come back to.
 *
 * Vercel sets VERCEL_URL without a scheme and only for the deployment's own
 * hostname, so NEXT_PUBLIC_SITE_URL wins when it is set — otherwise a preview
 * deploy would send people to production and a production deploy to nowhere.
 */
function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const OTP_COOKIE = "otp_phone";

/** Step 1 — send an OTP to the given Indian mobile number. */
export async function sendOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = indianMobileSchema.safeParse(formData.get("phone"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid phone number." };
  }

  const phone = toE164(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(OTP_COOKIE, phone, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  redirect("/verify");
}

/** Step 2 — verify the OTP and route the user by onboarding step. */
export async function verifyOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = otpSchema.safeParse(formData.get("otp"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid code." };
  }

  const cookieStore = await cookies();
  const phone = cookieStore.get(OTP_COOKIE)?.value;
  if (!phone) return { error: "Your code expired. Please request a new one." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: parsed.data,
    type: "sms",
  });
  if (error) return { error: error.message };

  cookieStore.delete(OTP_COOKIE);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let step: OnboardingStep = "role";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step")
      .eq("id", user.id)
      .maybeSingle();
    step = profile?.onboarding_step ?? "role";
  }

  redirect(step === "done" ? "/dashboard" : `/onboarding/${step}`);
}

/** Sign out and return to the landing page. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
