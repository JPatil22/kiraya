import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The private "where did this come from" note on a listing (0034).
 *
 * When a listing is seeded from a Facebook post or a broker's own ad, the
 * poster keeps the real source — name and number — here, privately. It never
 * reaches the public page and never travels through a contact exchange; it is
 * the poster's call-list for when a tenant bites, and the key for spotting one
 * broker's number behind six listings.
 */

export type SourceInput = {
  name: string | null;
  phone: string | null;
  note: string | null;
  hasAny: boolean;
};

function field(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export function readSourceInput(formData: FormData): SourceInput {
  const name = field(formData, "sourceName");
  const phone = field(formData, "sourcePhone");
  const note = field(formData, "sourceNote");
  return {
    name: name || null,
    phone: phone || null,
    note: note || null,
    hasAny: Boolean(name || phone || note),
  };
}

/**
 * Write (or clear) the source note for a listing. Delete-then-insert rather than
 * upsert, because the fixture client has no upsert — and because clearing every
 * field should remove the row, not leave an empty one behind.
 */
export async function saveListingSource(
  supabase: SupabaseClient<Database>,
  propertyId: string,
  userId: string,
  formData: FormData,
): Promise<void> {
  const s = readSourceInput(formData);

  await supabase.from("listing_sources").delete().eq("property_id", propertyId);
  if (!s.hasAny) return;

  await supabase.from("listing_sources").insert({
    property_id: propertyId,
    source_name: s.name,
    source_phone: s.phone,
    note: s.note,
    created_by: userId,
  });
}

export type ListingContact = { name: string | null; phone: string };

/**
 * The contact to hand a tenant on unlock when a listing was *seeded* from an
 * outside source (a Facebook post, a broker's own ad) rather than posted by the
 * real owner in person. When a source phone was recorded, the exchange should
 * reveal that real broker — not the seeded identity that technically posted the
 * row. A source *name* on its own can't be dialled, so with no phone we return
 * null and the caller falls back to the poster's own profile number.
 *
 * NOTE — RLS: this reads `listing_sources`, which policy keeps poster/admin-only.
 * That is correct in open mode (service-role), which is where seeded listings
 * live today. When the auth gate returns, revealing this to a tenant needs a
 * policy that lets someone holding a `contact_exchange` on the property read the
 * source's name + phone (and only those — never the private `note`). Until then
 * an authenticated tenant simply falls back to the poster's profile number.
 */
export async function getListingContact(
  supabase: SupabaseClient<Database>,
  propertyId: string,
): Promise<ListingContact | null> {
  const { data } = await supabase
    .from("listing_sources")
    .select("source_name, source_phone")
    .eq("property_id", propertyId)
    .maybeSingle();

  const phone = data?.source_phone?.trim();
  if (!phone) return null;
  return { name: data?.source_name?.trim() || null, phone };
}

/** Digits only, so "+91 98…", "98…" and "098…" group together. */
export function normalisePhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export type SourceGroup = {
  /** Normalised digits, or the sentinel for rows with no number. */
  key: string;
  phone: string | null;
  name: string | null;
  listings: { property_id: string; title: string; status: string; note: string | null }[];
};

const NO_NUMBER = "(no number)";

/**
 * Every seeded listing's source, grouped by the source's phone number — the
 * admin answer to "which flats came from this broker?" and "is one number
 * feeding six listings?" (0034). Grouped in JS rather than SQL so it works the
 * same against fixtures, and titles are fetched separately for the same reason
 * (no embedded joins in the fixture client).
 */
export async function getSourceGroups(
  supabase: SupabaseClient<Database>,
): Promise<SourceGroup[]> {
  const { data: sources } = await supabase
    .from("listing_sources")
    .select("property_id, source_name, source_phone, note");
  const rows = sources ?? [];
  if (rows.length === 0) return [];

  const { data: props } = await supabase
    .from("properties")
    .select("id, title, status")
    .in(
      "id",
      rows.map((r) => r.property_id),
    );
  const byId = new Map((props ?? []).map((p) => [p.id, p]));

  const groups = new Map<string, SourceGroup>();
  for (const r of rows) {
    const key = normalisePhone(r.source_phone) || NO_NUMBER;
    let group = groups.get(key);
    if (!group) {
      group = { key, phone: r.source_phone, name: r.source_name, listings: [] };
      groups.set(key, group);
    }
    // Keep the first non-empty name we see for the group's label.
    if (!group.name && r.source_name) group.name = r.source_name;
    const prop = byId.get(r.property_id);
    group.listings.push({
      property_id: r.property_id,
      title: prop?.title ?? "(listing removed)",
      status: prop?.status ?? "unknown",
      note: r.note,
    });
  }

  // Busiest numbers first — the ones worth calling, and the ones worth checking
  // for reposts. The no-number bucket sinks to the bottom.
  return [...groups.values()].sort((a, b) => {
    if (a.key === NO_NUMBER) return 1;
    if (b.key === NO_NUMBER) return -1;
    return b.listings.length - a.listings.length;
  });
}
