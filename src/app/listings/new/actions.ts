"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canPost, getDataClient, getSessionUser, needsPhone } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getActiveLocality } from "@/lib/locality";
import { checkboxOn, resolveBrokerage } from "@/lib/brokerage";
import { parseLocation } from "@/lib/geo";
import { saveListingSource } from "@/lib/listing-source";
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
  const missingPhone = needsPhone(user);
  if (missingPhone) return { error: missingPhone };
  if (!locality) {
    return { error: "Active locality is not configured. Contact support." };
  }

  const v = parsed.data;

  // 0023: what the poster's role permits them to claim about the fee.
  const fee = resolveBrokerage(user.role, v.brokerage, checkboxOn(formData.get("brokerageNone")));
  if (!fee.ok) return { fieldErrors: { brokerage: fee.message } };

  const where = parseLocation(formData.get("latitude"), formData.get("longitude"));
  if (!where.ok) return { fieldErrors: { latitude: where.message } };

  const { data: created, error } = await supabase
    .from("properties")
    .insert({
      posted_by: user.id,
      locality_id: locality.id,
      area_id: areaIdFrom(formData),
      latitude: where.latitude,
      longitude: where.longitude,
      title: v.title,
      description: v.description ? v.description : null,
      address_line: v.addressLine ? v.addressLine : null,
      bhk: v.bhk,
      furnishing: v.furnishing,
      occupancy_pref: v.occupancy,
      rent: v.rent,
      deposit: v.deposit,
      maintenance_monthly: v.maintenanceMonthly,
      brokerage: fee.amount,
      brokerage_disclosed: fee.disclosed,
      one_time_charges: v.oneTimeCharges,
      available_from: v.availableFrom,
      availability: v.availability,
      status: "pending_review",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Private note of where a seeded listing came from (0034), if given.
  if (created?.id) {
    await saveListingSource(supabase, created.id, user.id, formData);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?posted=1");
}

/** Empty select value means "not set", which is a legitimate answer. */
function areaIdFrom(formData: FormData): string | null {
  const raw = formData.get("areaId");
  return typeof raw === "string" && raw ? raw : null;
}
