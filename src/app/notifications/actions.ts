"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";

/**
 * Mark everything read.
 *
 * 0012 gives `notifications` an update policy scoped to the owner and nothing
 * else — no insert, no delete. A notification is a fact that happened; the only
 * thing anyone gets to change is whether they've seen it.
 */
export async function markAllRead() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return;
  }

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
