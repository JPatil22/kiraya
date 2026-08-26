import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Area, Database } from "@/types/database";
import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";

/**
 * Areas within the launch locality (0019).
 *
 * `cache()` because nearly every page that renders a filter or a form needs the
 * same list, and it changes about never.
 */
export const getAreas = cache(async function getAreas(
  supabase: SupabaseClient<Database>,
): Promise<Area[]> {
  const { data: localities } = await supabase
    .from("localities")
    .select("id")
    .eq("slug", ACTIVE_LOCALITY_SLUG)
    .maybeSingle();

  if (!localities) return [];

  const { data } = await supabase
    .from("areas")
    .select("*")
    .eq("locality_id", localities.id)
    // Zone then name: 0029 grouped the dropdown, and fifty areas sorted purely
    // alphabetically is a wall running from Akurdi to Yerwada.
    .order("zone")
    .order("name");

  return data ?? [];
});

/**
 * Areas grouped for a <select> (0029). Preserves the query's zone-then-name
 * order, and keeps anything without a zone in a trailing group rather than
 * dropping it.
 */
export function groupByZone(areas: Area[]): { zone: string; areas: Area[] }[] {
  const groups = new Map<string, Area[]>();
  for (const area of areas) {
    const key = area.zone ?? "Other";
    const existing = groups.get(key);
    if (existing) existing.push(area);
    else groups.set(key, [area]);
  }
  return [...groups.entries()].map(([zone, list]) => ({ zone, areas: list }));
}
