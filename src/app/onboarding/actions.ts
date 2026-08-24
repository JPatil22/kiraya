"use server";

import { redirect } from "next/navigation";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getActiveLocality } from "@/lib/locality";
import { roleSchema } from "@/lib/validators";
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
  // Tenants continue to the intent form; owners/brokers are done onboarding.
  const nextStep = parsed.data === "tenant" ? "intent" : "done";

  const { error } = await supabase
    .from("profiles")
    .update({
      role: parsed.data,
      active_locality_id: locality?.id ?? null,
      onboarding_step: nextStep,
    })
    .eq("id", user.id);
  if (error) throw error;

  redirect(nextStep === "intent" ? "/onboarding/intent" : "/dashboard");
}

export type { IntentState };

/**
 * Onboarding step 2 (tenants). The real implementation lives in
 * `@/app/intent/actions` so the funnel and the standalone /intent screen can
 * never drift — this stays exported because the OTP funnel is deferred, not
 * deleted, and its form imports it.
 */
export const submitIntent = saveIntent;
