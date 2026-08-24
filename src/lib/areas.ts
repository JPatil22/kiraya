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
    .order("name");

  return data ?? [];
});
