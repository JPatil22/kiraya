"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { friendlyDbError } from "@/lib/errors";

export type ShortlistState = { error?: string; saved?: boolean } | null;

/**
 * Save or un-save a listing.
 *
 * One action for both directions: the button is a toggle, and deriving the new
 * state from what's stored — rather than trusting an intent posted from the
 * page — means a stale tab can't un-save something the user just saved in
 * another. The unique constraint in 0011 makes a double-save a no-op anyway.
 */
export async function toggleShortlist(
  _prev: ShortlistState,
  formData: FormData,
): Promise<ShortlistState> {
  const propertyId = formData.get("propertyId");
  if (typeof propertyId !== "string") return { error: "Missing listing." };

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const { data: existing } = await supabase
    .from("shortlists")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("shortlists").delete().eq("id", existing.id);
    if (error) return { error: friendlyDbError(error) };
    revalidatePath("/shortlist");
    revalidatePath(`/listings/${propertyId}`);
    revalidatePath("/listings");
    return { saved: false };
  }

  const { error } = await supabase
    .from("shortlists")
    .insert({ user_id: user.id, property_id: propertyId });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/shortlist");
  revalidatePath(`/listings/${propertyId}`);
  revalidatePath("/listings");
  return { saved: true };
}
