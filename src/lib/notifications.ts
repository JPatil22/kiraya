import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Notification } from "@/types/database";

/**
 * Notifications (0012). Rows are written exclusively by database triggers —
 * there is no insert policy — so everything here is read or mark-as-read.
 */

/** Unread count for the header badge. Capped: "9+" is as useful as "137". */
export async function getUnreadCount(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .is("read_at", null)
    .limit(50);

  return (data ?? []).length;
}

export async function getNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data ?? [];
}
