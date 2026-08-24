import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactExchange, Database, Profile } from "@/types/database";

/**
 * Contact exchange (0010) — the step that turns a browsed listing into a phone
 * call, and the one thing the product was missing end to end.
 */

/**
 * How many numbers one tenant may unlock in a rolling day.
 *
 * This is a speed bump, not a wall: it lives in the app rather than the
 * database, so open mode's service-role client is subject to it only because
 * every write goes through the action. A determined scraper with a real session
 * is still slowed to a crawl and — more usefully — leaves one row per attempt,
 * which is what makes harvesting visible at all.
 */
export const CONTACT_DAILY_LIMIT = 10;

export type ContactWithProfile = ContactExchange & {
  /** Resolved separately: `profiles` is readable only once 0010's policy opens it. */
  counterparty: Pick<Profile, "id" | "full_name" | "phone" | "role"> | null;
};

export type LeadWithProfile = ContactExchange & {
  tenant: Pick<Profile, "id" | "full_name" | "phone"> | null;
  propertyTitle: string | null;
};

/** The tenant's existing exchange for a listing, if they already asked. */
export async function getMyExchange(
  supabase: SupabaseClient<Database>,
  propertyId: string,
  tenantId: string,
): Promise<ContactExchange | null> {
  const { data } = await supabase
    .from("contact_exchanges")
    .select("*")
    .eq("property_id", propertyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return data ?? null;
}

/** Exchanges this tenant made in the last 24h — the rate-limit input. */
export async function countRecentExchanges(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data } = await supabase
    .from("contact_exchanges")
    .select("id")
    .eq("tenant_id", tenantId)
    .gte("created_at", since);

  return (data ?? []).length;
}

/** Look up one profile the caller is now entitled to see. */
export async function getCounterparty(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Pick<Profile, "id" | "full_name" | "phone" | "role"> | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role")
    .eq("id", userId)
    .maybeSingle();

  return data ?? null;
}

/**
 * Everyone who has asked to reach this person — the owner's lead list.
 *
 * Deliberately two queries plus a join in JS rather than one nested select:
 * `profiles` is reachable here only through 0010's exchange policy, and PostgREST
 * embedding across a policy-gated relationship is exactly the kind of thing that
 * silently returns nulls instead of failing loudly.
 */
export async function getLeads(
  supabase: SupabaseClient<Database>,
  counterpartyId: string,
): Promise<LeadWithProfile[]> {
  const { data: exchanges } = await supabase
    .from("contact_exchanges")
    .select("*")
    .eq("counterparty_id", counterpartyId)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = exchanges ?? [];
  if (rows.length === 0) return [];

  const [profiles, properties] = await Promise.all([
    Promise.all(rows.map((r) => getCounterparty(supabase, r.tenant_id))),
    Promise.all(
      rows.map(async (r) => {
        const { data } = await supabase
          .from("properties")
          .select("title")
          .eq("id", r.property_id)
          .maybeSingle();
        return data?.title ?? null;
      }),
    ),
  ]);

  return rows.map((row, i) => ({
    ...row,
    tenant: profiles[i] ? { id: profiles[i]!.id, full_name: profiles[i]!.full_name, phone: profiles[i]!.phone } : null,
    propertyTitle: properties[i],
  }));
}

/** A phone number as a dialable link, or null when we don't have one. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.length >= 8 ? `tel:${cleaned}` : null;
}
