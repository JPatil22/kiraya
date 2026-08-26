import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Locality } from "@/types/database";
import { logRead } from "@/lib/errors";

/** The single locality this deployment serves. */
export const ACTIVE_LOCALITY_SLUG =
  process.env.NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG ?? "pune";

/**
 * Fetch the active locality row (id, name, staleness window, …).
 * Cached per request — several pages ask for it more than once.
 */
export const getActiveLocality = cache(async function getActiveLocality(
  supabase: SupabaseClient<Database>,
): Promise<Locality | null> {
  const { data, error } = await supabase
    .from("localities")
    .select("*")
    .eq("slug", ACTIVE_LOCALITY_SLUG)
    .maybeSingle();
  logRead("getActiveLocality", error);
  return data;
});
