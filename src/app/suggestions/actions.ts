"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { suggestionResponseSchema } from "@/lib/validators";
import { friendlyDbError } from "@/lib/errors";
import { getMyExchange } from "@/lib/contact";

export type RespondState = { error?: string } | null;

/**
 * MVP4 — the tenant answers a suggestion. `responded_at` is stamped by the
 * trigger in 0004, so the response time is recorded whatever the app does.
 */
export async function respondToSuggestion(
  _prev: RespondState,
  formData: FormData,
): Promise<RespondState> {
  const id = formData.get("suggestionId");
  const parsed = suggestionResponseSchema.safeParse(formData.get("response"));

  if (typeof id !== "string" || !id) return { error: "Missing suggestion." };
  if (!parsed.success) return { error: "Unknown response." };

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  // Only the tenant who owns the target intent may respond. RLS enforces this
  // too; checking here keeps open mode (service-role) honest.
  const { data: suggestion } = await supabase
    .from("broker_suggestions")
    .select("tenant_intent_id, broker_id, property_id")
    .eq("id", id)
    .maybeSingle();
  if (!suggestion) return { error: "That suggestion no longer exists." };

  const { data: intent } = await supabase
    .from("tenant_intents")
    .select("tenant_id")
    .eq("id", suggestion.tenant_intent_id)
    .maybeSingle();

  if (!intent || intent.tenant_id !== user.id) {
    return { error: "That suggestion isn't yours to answer." };
  }

  const { error } = await supabase
    .from("broker_suggestions")
    .update({ status: parsed.data })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error) };

  // Accepting is what the UI has always promised would "share contact details".
  // Until 0010 there was nothing behind that sentence; now it exchanges numbers
  // through the same recorded path a direct enquiry uses, so the broker appears
  // in the tenant's contacts and the tenant appears on the broker's dashboard.
  if (parsed.data === "accepted") {
    const existing = await getMyExchange(supabase, suggestion.property_id, user.id);
    if (!existing) {
      const { error: exchangeError } = await supabase.from("contact_exchanges").insert({
        property_id: suggestion.property_id,
        tenant_id: user.id,
        counterparty_id: suggestion.broker_id,
        source: "suggestion",
      });
      // A failed exchange shouldn't silently swallow a successful acceptance —
      // the response is already recorded, so say what didn't happen.
      if (exchangeError) {
        revalidatePath("/suggestions");
        return { error: `Accepted, but sharing contact failed: ${friendlyDbError(exchangeError)}` };
      }
    }
    revalidatePath("/dashboard");
  }

  revalidatePath("/suggestions");
  revalidatePath(`/listings/${suggestion.property_id}`);
  return null;
}
