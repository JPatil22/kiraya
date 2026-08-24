"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { friendlyDbError } from "@/lib/errors";
import type { VisitStatus } from "@/types/database";

export type ScheduleState = { error?: string; ok?: string } | null;

/**
 * Propose a time to view a listing.
 *
 * Standing comes from the contact exchange, which 0020's guard re-checks — but
 * open mode runs as service-role and skips RLS, so ownership is verified here
 * too rather than trusting the posted ids.
 */
export async function proposeVisit(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const exchangeId = formData.get("contactExchangeId");
  const when = formData.get("scheduledFor");

  if (typeof exchangeId !== "string") return { error: "Missing enquiry." };
  if (typeof when !== "string" || !when) return { error: "Pick a date and time." };

  const at = new Date(when);
  if (Number.isNaN(at.getTime())) return { error: "That date didn't parse." };
  if (at.getTime() < Date.now()) return { error: "That time has already passed." };

  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" ? rawNote.trim().slice(0, 500) : "";

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const { data: exchange } = await supabase
    .from("contact_exchanges")
    .select("id, tenant_id, counterparty_id, property_id")
    .eq("id", exchangeId)
    .maybeSingle();

  if (!exchange) return { error: "You need contact details first." };
  if (exchange.tenant_id !== user.id && exchange.counterparty_id !== user.id) {
    return { error: "That isn't your enquiry." };
  }

  const { error } = await supabase.from("visits").insert({
    property_id: exchange.property_id,
    tenant_id: exchange.tenant_id,
    host_id: exchange.counterparty_id,
    contact_exchange_id: exchange.id,
    scheduled_for: at.toISOString(),
    proposed_by: user.id,
    note: note ? note : null,
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/listings/${exchange.property_id}`);
  revalidatePath("/dashboard");
  return { ok: "Proposed. They'll see it and can confirm." };
}

const ANSWERS: VisitStatus[] = ["confirmed", "declined", "cancelled"];

/** Confirm, decline or call off a proposed visit. */
export async function answerVisit(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const visitId = formData.get("visitId");
  const answer = formData.get("status");

  if (typeof visitId !== "string") return { error: "Missing visit." };
  if (typeof answer !== "string" || !(ANSWERS as string[]).includes(answer)) {
    return { error: "Unknown response." };
  }

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const { data: visit } = await supabase
    .from("visits")
    .select("id, tenant_id, host_id, property_id, proposed_by, status")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit) return { error: "That visit no longer exists." };
  if (visit.tenant_id !== user.id && visit.host_id !== user.id) {
    return { error: "That isn't your visit." };
  }

  // Answering your own proposal isn't answering, it's cancelling. Allow the
  // cancel, refuse the self-confirm — otherwise anyone could "agree" alone.
  if (answer === "confirmed" && visit.proposed_by === user.id) {
    return { error: "The other person needs to confirm this one." };
  }

  const { error } = await supabase
    .from("visits")
    .update({ status: answer as VisitStatus })
    .eq("id", visitId);

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/listings/${visit.property_id}`);
  revalidatePath("/dashboard");
  return { ok: `Visit ${answer}.` };
}
