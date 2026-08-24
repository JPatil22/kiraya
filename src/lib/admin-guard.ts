import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataClient, getDevRole, getSessionUser, type SessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import type { Database, UserRole } from "@/types/database";

/**
 * Page-level gate for /admin/**. The real boundary is `is_admin()` inside the
 * 0005 RPCs and every RLS policy — this only decides what to render.
 */
export type AdminContext =
  | { ok: true; supabase: SupabaseClient<Database>; user: SessionUser }
  | { ok: false; devRole: UserRole };

export async function requireAdminPage(): Promise<AdminContext> {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { ok: false, devRole: await getDevRole() };
  }

  if (user.role !== "admin") redirect("/dashboard");

  return { ok: true, supabase, user };
}
