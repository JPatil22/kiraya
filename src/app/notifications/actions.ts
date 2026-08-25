"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { emailSchema } from "@/lib/validators";

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

export type EmailPrefState = { error?: string; ok?: string } | null;

/**
 * Add or clear the address notifications are emailed to (0026).
 *
 * Blank clears it, which is the unsubscribe link every one of those emails
 * promises. Nothing else about the account depends on this: phone stays the
 * identity bar, and a profile with no email simply keeps its notices in-app.
 */
export async function saveEmail(
  _prev: EmailPrefState,
  formData: FormData,
): Promise<EmailPrefState> {
  const parsed = emailSchema.safeParse(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check that address." };
  }

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const email = parsed.data === "" ? null : parsed.data;
  const { error } = await supabase.from("profiles").update({ email }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/notifications");
  return { ok: email ? `Emails will go to ${email}.` : "Emails are off. Notices stay in the app." };
}
