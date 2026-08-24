"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { suggestionSchema } from "@/lib/validators";

export type SuggestState = { error?: string; ok?: boolean } | null;

/**
 * MVP4 — a broker suggests one of their live listings to an active intent.
 *
 * The same three rules are enforced by the 0004 insert policy at the DB layer;
 * they're repeated here so the user gets a sentence instead of a constraint
 * violation, and so open mode (which bypasses RLS) still behaves correctly.
 */
export async function sendSuggestion(
  _prev: SuggestState,
  formData: FormData,
): Promise<SuggestState> {
  const parsed = suggestionSchema.safeParse({
    tenantIntentId: formData.get("tenantIntentId"),
    propertyId: formData.get("propertyId"),
    message: formData.get("message") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pick a listing to suggest." };
  }

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  if (user.role !== "broker") {
    return { error: "Only brokers can send suggestions." };
  }
  if (user.isSuspended) {
    return { error: "Your account is suspended. Contact support." };
  }

  const v = parsed.data;

  // Must be the broker's own listing, and it must be live.
  const { data: property } = await supabase
    .from("properties")
    .select("posted_by, status")
    .eq("id", v.propertyId)
    .maybeSingle();

  if (!property || property.status !== "live") {
    return { error: "You can only suggest a listing that's already live." };
  }
  if (property.posted_by !== user.id) {
    return { error: "You can only suggest your own listings." };
  }

  // And the demand has to still be open.
  const { data: intent } = await supabase
    .from("tenant_intents")
    .select("status")
    .eq("id", v.tenantIntentId)
    .maybeSingle();

  if (!intent || intent.status !== "active") {
    return { error: "That tenant is no longer looking." };
  }

  const { error } = await supabase.from("broker_suggestions").insert({
    broker_id: user.id,
    tenant_intent_id: v.tenantIntentId,
    property_id: v.propertyId,
    message: v.message ? v.message : null,
  });

  if (error) {
    // unique (tenant_intent_id, property_id) — no repeat-blasting the same unit.
    return error.code === "23505"
      ? { error: "You've already suggested this listing to this tenant." }
      : { error: error.message };
  }

  revalidatePath("/broker/intents");
  return { ok: true };
}
