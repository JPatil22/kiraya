"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canPost, getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getActiveLocality } from "@/lib/locality";
import { listingSchema } from "@/lib/validators";

export type ListingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

/**
 * Create a listing. It always lands in `pending_review` — publishing and
 * verification are admin-only, enforced by the DB trigger in migration 0002,
 * so a poster can never mark their own listing live or "verified".
 */
export async function createListing(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const parsed = listingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    addressLine: formData.get("addressLine") ?? "",
    bhk: formData.get("bhk"),
    furnishing: formData.get("furnishing"),
    occupancy: formData.get("occupancy"),
    rent: formData.get("rent"),
    deposit: formData.get("deposit"),
    maintenanceMonthly: formData.get("maintenanceMonthly"),
    brokerage: formData.get("brokerage"),
    oneTimeCharges: formData.get("oneTimeCharges"),
    availableFrom: formData.get("availableFrom"),
    availability: formData.get("availability"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const locality = await getActiveLocality(supabase);

  if (!canPost(user.role)) {
    return { error: "Only owners and brokers can post a property." };
  }
  if (user.isSuspended) {
    return { error: "Your account is suspended. Contact support." };
  }
  if (!locality) {
    return { error: "Active locality is not configured. Contact support." };
  }

  const v = parsed.data;
  const { error } = await supabase.from("properties").insert({
    posted_by: user.id,
    locality_id: locality.id,
    title: v.title,
    description: v.description ? v.description : null,
    address_line: v.addressLine ? v.addressLine : null,
    bhk: v.bhk,
    furnishing: v.furnishing,
    occupancy_pref: v.occupancy,
    rent: v.rent,
    deposit: v.deposit,
    maintenance_monthly: v.maintenanceMonthly,
    brokerage: v.brokerage,
    one_time_charges: v.oneTimeCharges,
    available_from: v.availableFrom,
    availability: v.availability,
    status: "pending_review",
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect("/dashboard?posted=1");
}
