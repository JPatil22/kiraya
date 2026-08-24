"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { indianMobileSchema, otpSchema, toE164 } from "@/lib/validators";
import type { OnboardingStep } from "@/types/database";

export type AuthState = { error: string } | null;

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
