import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { requireEnv } from "@/lib/env";

/** Browser-side Supabase client (uses the anon key + user cookies). */
export function createClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
