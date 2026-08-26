"use server";

import { redirect } from "next/navigation";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getActiveLocality } from "@/lib/locality";
import { indianMobileSchema, roleSchema, toE164 } from "@/lib/validators";
import { saveIntent, type IntentState } from "@/app/intent/actions";

/** Onboarding step 1 — persist the chosen role and advance the state machine. */
export async function selectRole(formData: FormData) {
  const parsed = roleSchema.safeParse(formData.get("role"));
  if (!parsed.success) throw new Error("Invalid role selection.");

  // Through `getSessionUser`, not `supabase.auth.getUser()` — that direct call
  // is what made this action dead in open mode (no session ⇒ /login).
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return;
  }

  const locality = await getActiveLocality(supabase);
  // 0030: everybody gives a number before anything else. Google proved an
  // email; the contact exchange trades phone numbers.
  const nextStep = "phone";

  const { error } = await supabase
    .from("profiles")
    .update({
      role: parsed.data,
      active_locality_id: locality?.id ?? null,
      onboarding_step: nextStep,
    })
    .eq("id", user.id);
  if (error) throw error;

  redirect("/onboarding/phone");
}

export type { IntentState };

/**
 * Onboarding step 2 (tenants). The real implementation lives in
 * `@/app/intent/actions` so the funnel and the standalone /intent screen can
 * never drift — this stays exported because the OTP funnel is deferred, not
 * deleted, and its form imports it.
 */
export const submitIntent = saveIntent;

export type PhoneState = { error?: string } | null;

/**
 * Onboarding step 2 — save the number and move on (0030).
 *
 * Deliberately does NOT stamp `phone_verified_at`. Nothing has checked this
 * number: there is no DLT-registered sender, so no code can be sent. A claim
 * wearing the clothes of a verified fact is the exact thing this codebase
 * refuses everywhere else — an unset brokerage, a never-verified listing — and
 * it would be no better here.
 *
 * Where it goes next is the same branch selectRole used to make: tenants owe an
 * intent, owners and brokers are done.
 */
export async function savePhone(_prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const parsed = indianMobileSchema.safeParse(formData.get("phone"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check that number." };
  }

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const nextStep = user.role === "tenant" ? "intent" : "done";

  const { error } = await supabase
    .from("profiles")
    .update({ phone: toE164(parsed.data), onboarding_step: nextStep })
    .eq("id", user.id);
  if (error) return { error: error.message };

  redirect(nextStep === "intent" ? "/onboarding/intent" : "/dashboard");
}
