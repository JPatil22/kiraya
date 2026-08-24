"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getActiveLocality } from "@/lib/locality";
import { intentSchema } from "@/lib/validators";
import { friendlyDbError } from "@/lib/errors";
import type { IntentStatus } from "@/types/database";

export type IntentState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

/**
 * Create or update the tenant's rental intent.
 *
 * This replaces the insert-only version that lived in `onboarding/actions.ts`,
 * which had two problems: it called `supabase.auth.getUser()` directly — so in
 * open mode it saw no session and bounced to /login — and it could only ever
 * insert, meaning an intent was write-once. Combined with middleware sending
 * every `/onboarding/*` request to /dashboard, the form was unreachable and
 * unusable, which quietly made the whole broker-suggestion half of the product
 * demo-only.
 *
 * Going through `getDataClient()`/`getSessionUser()` is what makes it work in
 * all three modes, and is the rule CLAUDE.md sets for exactly this reason.
 */
export async function saveIntent(_prev: IntentState, formData: FormData): Promise<IntentState> {
  const parsed = intentSchema.safeParse({
    budgetMin: formData.get("budgetMin"),
    budgetMax: formData.get("budgetMax"),
    bhk: formData.get("bhk"),
    moveInDate: formData.get("moveInDate"),
    furnishing: formData.get("furnishing"),
    occupancy: formData.get("occupancy"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  if (user.role !== "tenant") {
    return { error: "Only a tenant has a rental intent." };
  }

  const locality = await getActiveLocality(supabase);
  if (!locality) return { error: "Active locality is not configured. Contact support." };

  const v = parsed.data;
  const fields = {
    area_id: areaIdFrom(formData),
    budget_min: v.budgetMin,
    budget_max: v.budgetMax,
    bhk: v.bhk,
    move_in_date: v.moveInDate,
    furnishing: v.furnishing,
    occupancy: v.occupancy,
    notes: v.notes ? v.notes : null,
  };

  // One standing intent per tenant. Editing updates it rather than stacking a
  // second one, which would double every broker's view of what they want.
  const { data: existing } = await supabase
    .from("tenant_intents")
    .select("id")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("tenant_intents")
        // Saving an edit means you're still looking, so it comes back to active.
        .update({ ...fields, status: "active" })
        .eq("id", existing.id)
    : await supabase.from("tenant_intents").insert({
        tenant_id: user.id,
        locality_id: locality.id,
        ...fields,
      });

  if (error) return { error: friendlyDbError(error) };

  // Finishing the intent is what completes onboarding when the gate is on.
  if (user.onboardingStep !== "done") {
    await supabase.from("profiles").update({ onboarding_step: "done" }).eq("id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/intent");
  redirect("/dashboard?intent=saved");
}

/**
 * Pause or resume the intent.
 *
 * `0004` scopes the broker view to `status = 'active'`, so this is the switch
 * that stops suggestions arriving once someone has found a place — without
 * deleting what they told us, which they'd only have to type again.
 */
export async function setIntentStatus(formData: FormData) {
  const raw = formData.get("status");
  const status: IntentStatus =
    raw === "paused" ? "paused" : raw === "fulfilled" ? "fulfilled" : "active";

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return;
  }

  await supabase.from("tenant_intents").update({ status }).eq("tenant_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/intent");
}

/** Empty select value means "not set", which is a legitimate answer. */
function areaIdFrom(formData: FormData): string | null {
  const raw = formData.get("areaId");
  return typeof raw === "string" && raw ? raw : null;
}
