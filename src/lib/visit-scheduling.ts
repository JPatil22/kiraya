import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Visit, VisitStatus } from "@/types/database";

/**
 * Arranged viewings (0020). Standing to schedule comes from a contact
 * exchange — the exchange is the introduction, and without it this would be a
 * channel for messaging strangers.
 */

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  proposed: "Awaiting a reply",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export type VisitWithContext = Visit & { propertyTitle: string | null };

/** Everything either side of this person has arranged, newest first. */
export async function getMyVisits(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<VisitWithContext[]> {
  const [{ data: asTenant }, { data: asHost }] = await Promise.all([
    supabase.from("visits").select("*").eq("tenant_id", userId),
    supabase.from("visits").select("*").eq("host_id", userId),
  ]);

  const all = [...(asTenant ?? []), ...(asHost ?? [])].sort((a, b) =>
    a.scheduled_for < b.scheduled_for ? 1 : -1,
  );

  return Promise.all(
    all.map(async (v) => {
      const { data } = await supabase
        .from("properties")
        .select("title")
        .eq("id", v.property_id)
        .maybeSingle();
      return { ...v, propertyTitle: data?.title ?? null };
    }),
  );
}

/** The visit for one listing, if this tenant has arranged one. */
export async function getVisitForListing(
  supabase: SupabaseClient<Database>,
  userId: string,
  propertyId: string,
): Promise<Visit | null> {
  const { data } = await supabase
    .from("visits")
    .select("*")
    .eq("property_id", propertyId)
    .eq("tenant_id", userId)
    .order("scheduled_for", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

/**
 * A confirmed visit whose time has passed.
 *
 * This is a much better prompt for the post-visit question than "you asked for
 * a number three days ago" — it knows a viewing was actually arranged.
 */
export function isVisitDone(visit: Visit | null): boolean {
  return Boolean(
    visit && visit.status === "confirmed" && Date.parse(visit.scheduled_for) < Date.now(),
  );
}
