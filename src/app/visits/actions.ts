"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { friendlyDbError } from "@/lib/errors";
import type { VisitOutcome } from "@/types/database";

export type VisitFeedbackState = { error?: string; ok?: boolean } | null;

const OUTCOMES: VisitOutcome[] = [
  "as_described",
  "did_not_match",
  "unreachable",
  "did_not_visit",
];

function isOutcome(value: FormDataEntryValue | null): value is VisitOutcome {
  return typeof value === "string" && (OUTCOMES as string[]).includes(value);
}

/**
 * Answer "did you visit, and was it as described?".
 *
 * Upsert rather than insert-only: a three-tap control invites mis-taps, and 0015
 * lets the person who answered correct their own row. A trust signal built on
 * answers nobody can fix is a worse signal, not a purer one.
 */
export async function submitVisitFeedback(
  _prev: VisitFeedbackState,
  formData: FormData,
): Promise<VisitFeedbackState> {
  const exchangeId = formData.get("contactExchangeId");
  const outcomeRaw = formData.get("outcome");

  if (typeof exchangeId !== "string") return { error: "Missing enquiry." };
  if (!isOutcome(outcomeRaw)) return { error: "Pick what happened." };

  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" ? rawNote.trim().slice(0, 500) : "";

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  // Read the exchange rather than trusting the posted property id: the guard in
  // 0015 checks the same thing, but open mode runs as service-role and skips
  // RLS, so the app has to hold the line too.
  const { data: exchange } = await supabase
    .from("contact_exchanges")
    .select("id, tenant_id, property_id")
    .eq("id", exchangeId)
    .maybeSingle();

  if (!exchange) return { error: "That enquiry no longer exists." };
  if (exchange.tenant_id !== user.id) return { error: "That isn't your enquiry." };

  const { data: existing } = await supabase
    .from("visit_feedback")
    .select("id")
    .eq("contact_exchange_id", exchangeId)
    .maybeSingle();

  const fields = {
    contact_exchange_id: exchange.id,
    property_id: exchange.property_id,
    tenant_id: user.id,
    outcome: outcomeRaw,
    note: note ? note : null,
  };

  const { error } = existing
    ? await supabase.from("visit_feedback").update(fields).eq("id", existing.id)
    : await supabase.from("visit_feedback").insert(fields);

  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/dashboard");
  revalidatePath(`/listings/${exchange.property_id}`);
  return { ok: true };
}
