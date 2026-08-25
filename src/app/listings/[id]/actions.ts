"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { availabilitySchema, listingSchema, mismatchSchema } from "@/lib/validators";
import { BEDROOMS_FOR_BHK } from "@/lib/rooms";
import { friendlyDbError } from "@/lib/errors";
import { CONTACT_DAILY_LIMIT, countRecentExchanges, getMyExchange } from "@/lib/contact";
import { checkboxOn, getPosterRole, resolveBrokerage } from "@/lib/brokerage";
import type { AvailabilityStatus, BhkType } from "@/types/database";

export type MismatchState = { error?: string; ok?: boolean } | null;

/**
 * MVP3 — a tenant reports that the listing didn't match reality.
 *
 * Two open reports on the same listing flip `has_warning` in
 * `v_listings_public`, which every viewer then sees. The DB allows one open
 * report per person per listing (partial unique index in 0003), so a single
 * annoyed tenant can't manufacture a warning on their own.
 */
export async function reportMismatch(
  _prev: MismatchState,
  formData: FormData,
): Promise<MismatchState> {
  const parsed = mismatchSchema.safeParse({
    propertyId: formData.get("propertyId"),
    type: formData.get("type"),
    description: formData.get("description") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pick what didn't match." };
  }

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const v = parsed.data;

  // Report on what you saw, not on your own listing.
  const { data: property } = await supabase
    .from("properties")
    .select("posted_by, status")
    .eq("id", v.propertyId)
    .maybeSingle();

  if (!property || property.status !== "live") {
    return { error: "That listing isn't live." };
  }
  if (property.posted_by === user.id) {
    return { error: "You can't report your own listing." };
  }

  const { error } = await supabase.from("mismatch_reports").insert({
    property_id: v.propertyId,
    reported_by: user.id,
    type: v.type,
    description: v.description ? v.description : null,
  });

  if (error) {
    // The partial unique index is the one we expect to trip.
    return { error: friendlyDbError(error) };
  }

  revalidatePath(`/listings/${v.propertyId}`);
  revalidatePath("/listings");
  return { ok: true };
}

export type MaintenanceState = { error?: string; ok?: string } | null;

/**
 * Only the listing's poster (or an admin) may maintain it.
 *
 * `liveOnly` separates the two callers: confirming availability only makes
 * sense for something tenants can actually see, but editing must work while a
 * listing is still in `pending_review` — that's precisely when a poster is most
 * likely to be fixing what review flagged.
 */
async function requirePoster(propertyId: string, { liveOnly = false } = {}) {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { supabase, user: null, error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const { data: property } = await supabase
    .from("properties")
    .select("posted_by, status")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) return { supabase, user: null, error: "That listing doesn't exist." };
  if (liveOnly && property.status !== "live") {
    return { supabase, user: null, error: "Only a live listing can be confirmed." };
  }
  if (property.posted_by !== user.id && user.role !== "admin") {
    return { supabase, user: null, error: "That isn't your listing." };
  }

  return {
    supabase,
    user,
    status: property.status,
    postedBy: property.posted_by,
    error: null,
  };
}

/**
 * The poster confirms the current truth of their own listing.
 *
 * Confirmation and availability are deliberately ONE action, not two. "Still
 * available", "now rented" and "on hold" are all the same statement — *I looked
 * just now, and this is the state* — so each of them restamps the freshness
 * clock. That's what stops a rented flat from also being a stale one, and it
 * means the owner never has to press two buttons to tell the truth once.
 *
 * Before 0009 this was impossible: verification was admin-only, so freshness
 * could only decay. The stamp is written in the poster's own name, which the
 * read-model exposes as `verified_by_poster` so the UI can say who said it.
 */
export async function confirmListing(
  _prev: MaintenanceState,
  formData: FormData,
): Promise<MaintenanceState> {
  const propertyId = formData.get("propertyId");
  if (typeof propertyId !== "string") return { error: "Missing listing." };

  const parsed = availabilitySchema.safeParse(formData.get("availability"));
  if (!parsed.success) return { error: "Pick the current availability." };

  const { supabase, user, error } = await requirePoster(propertyId, { liveOnly: true });
  if (error || !user) return { error: error ?? "Not allowed." };

  const availability = parsed.data;

  const { error: updateError } = await supabase
    .from("properties")
    .update({
      availability,
      // The guard in 0009 requires both of these: own name, dated now.
      last_verified_at: new Date().toISOString(),
      last_verified_by: user.id,
    })
    .eq("id", propertyId);

  if (updateError) return { error: friendlyDbError(updateError) };

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath("/listings");
  revalidatePath("/dashboard");

  return { ok: CONFIRM_MESSAGE[availability] };
}

const CONFIRM_MESSAGE: Record<AvailabilityStatus, string> = {
  available: "Confirmed — tenants now see this as verified just now.",
  on_hold: "Marked on hold, and the freshness stamp updated.",
  rented: "Marked as rented. It's out of the feed, but the page still works.",
};

export type EditState = { error?: string; fieldErrors?: Record<string, string> } | null;

/**
 * Edit a live listing.
 *
 * Two decisions worth stating, because both are about truth rather than CRUD:
 *
 * 1. **An edit is a confirmation.** You're telling us what's true right now, so
 *    it restamps the freshness clock in your own name — exactly like the
 *    confirm buttons. The side effect is deliberate: a listing Kiraya verified
 *    at ₹16,000 stops claiming "Verified by Kiraya" the moment the owner
 *    changes the rent, because what we checked no longer exists. It drops to
 *    "Confirmed by the person who posted it" on its own, via `verified_by_poster`.
 *
 * 2. **It stays live.** Sending an edited listing back to `pending_review`
 *    would yank it out of the feed over a typo. Instead every field change is
 *    written to the public timeline by 0003's trigger, so a tenant sees
 *    "rent ₹16,000 → ₹22,000 · 2 days ago" on the page itself. Surfacing the
 *    change beats hiding the listing.
 */
export async function updateListing(_prev: EditState, formData: FormData): Promise<EditState> {
  const propertyId = formData.get("propertyId");
  if (typeof propertyId !== "string") return { error: "Missing listing." };

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

  const { supabase, user, status, postedBy, error } = await requirePoster(propertyId);
  if (error || !user || !postedBy) return { error: error ?? "Not allowed." };

  const v = parsed.data;

  const fee = resolveBrokerage(
    postedBy === user.id ? user.role : await getPosterRole(supabase, postedBy),
    v.brokerage,
    checkboxOn(formData.get("brokerageNone")),
  );
  if (!fee.ok) return { fieldErrors: { brokerage: fee.message } };

  // Shrinking the configuration can strand photos: 0008's room rules are
  // checked when a photo is written, not when the property changes under it, so
  // a 2BHK → 1BHK would quietly leave a "Bedroom 2" shot that can no longer
  // exist. Refuse and name the rooms rather than delete someone's photos for
  // them — they may want to re-slot them first.
  const stranded = await strandedRooms(supabase, propertyId, v.bhk);
  if (stranded.length > 0) {
    return {
      error:
        `A ${labelForBhk(v.bhk)} has no ${stranded.join(" or ")}. ` +
        `Delete those photos on the photos page first, then change the configuration.`,
    };
  }

  const { error: updateError } = await supabase
    .from("properties")
    .update({
      title: v.title,
      area_id: areaIdFrom(formData),
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
      // See (1) above: editing is confirming — but only for something a tenant
      // can actually see. Stamping a listing that has never been published
      // would be confirming a claim nobody has been shown yet, and the admin
      // review that promotes it stamps it properly anyway.
      ...(status === "live"
        ? { last_verified_at: new Date().toISOString(), last_verified_by: user.id }
        : {}),
    })
    .eq("id", propertyId);

  if (updateError) return { error: friendlyDbError(updateError) };

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath("/listings");
  revalidatePath("/dashboard");
  redirect(`/listings/${propertyId}?updated=1`);
}

/** Room slots that exist today but wouldn't survive a move to `nextBhk`. */
async function strandedRooms(
  supabase: Awaited<ReturnType<typeof getDataClient>>,
  propertyId: string,
  nextBhk: BhkType,
): Promise<string[]> {
  const { data } = await supabase
    .from("property_photos")
    .select("room_type, room_index")
    .eq("property_id", propertyId)
    .eq("room_type", "bedroom");

  const allowed = BEDROOMS_FOR_BHK[nextBhk];
  return (data ?? [])
    .filter((p) => p.room_index > allowed)
    .map((p) => (allowed === 0 ? "separate bedroom" : `bedroom ${p.room_index}`))
    .filter((label, i, all) => all.indexOf(label) === i);
}

const labelForBhk = (bhk: BhkType) =>
  ({ "1rk": "1 RK", "1bhk": "1 BHK", "2bhk": "2 BHK", "3bhk": "3 BHK", "4plus": "4+ BHK" })[bhk];

export type ContactState = { error?: string; ok?: boolean } | null;

/**
 * A tenant asks to reach whoever posted a listing (0010).
 *
 * Both numbers become visible in the same instant — the poster's to the tenant
 * here, the tenant's to the poster on their dashboard. Nothing waits for an
 * approval, because there is no notification channel yet and a request nobody
 * is told about is a request nobody answers.
 *
 * The row is the product: it's the poster's lead list, and it's the audit trail
 * that makes bulk number-harvesting something you can see.
 */
export async function requestContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const propertyId = formData.get("propertyId");
  if (typeof propertyId !== "string") return { error: "Missing listing." };

  const rawMessage = formData.get("message");
  const message = typeof rawMessage === "string" ? rawMessage.trim().slice(0, 500) : "";

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const { data: property } = await supabase
    .from("properties")
    .select("posted_by, status")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property || property.status !== "live") return { error: "That listing isn't live." };
  if (property.posted_by === user.id) {
    return { error: "That's your own listing." };
  }

  // Already asked: nothing to do, the number is already on their screen.
  const existing = await getMyExchange(supabase, propertyId, user.id);
  if (existing) {
    revalidatePath(`/listings/${propertyId}`);
    return { ok: true };
  }

  // Open mode runs as service-role, which bypasses RLS — so the limit has to be
  // checked here to apply in both modes at all.
  const recent = await countRecentExchanges(supabase, user.id);
  if (recent >= CONTACT_DAILY_LIMIT) {
    return {
      error: `You've unlocked ${CONTACT_DAILY_LIMIT} numbers today. Try again tomorrow — it keeps owners from being harvested.`,
    };
  }

  const { error } = await supabase.from("contact_exchanges").insert({
    property_id: propertyId,
    tenant_id: user.id,
    counterparty_id: property.posted_by,
    source: "listing",
    message: message ? message : null,
  });

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/listings/${propertyId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export type ReplyState = { error?: string; ok?: boolean } | null;

/**
 * The poster answers a mismatch report about their listing.
 *
 * 0017's trigger is what actually constrains this — an RLS policy can't limit
 * which columns an update touches, so without it a policy generous enough to
 * permit a reply would also let the accused rewrite the accusation or close the
 * report against themselves.
 */
export async function replyToReport(
  _prev: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const reportId = formData.get("reportId");
  if (typeof reportId !== "string") return { error: "Missing report." };

  const raw = formData.get("response");
  const response = typeof raw === "string" ? raw.trim().slice(0, 1000) : "";
  if (!response) return { error: "Write something first." };

  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const { data: report } = await supabase
    .from("mismatch_reports")
    .select("id, property_id")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return { error: "That report no longer exists." };

  // Open mode is service-role and skips RLS, so ownership is checked here too.
  const { data: property } = await supabase
    .from("properties")
    .select("posted_by")
    .eq("id", report.property_id)
    .maybeSingle();

  if (!property || (property.posted_by !== user.id && user.role !== "admin")) {
    return { error: "That isn't your listing." };
  }

  const { error } = await supabase
    .from("mismatch_reports")
    .update({ owner_response: response })
    .eq("id", reportId);

  if (error) return { error: friendlyDbError(error) };

  revalidatePath(`/listings/${report.property_id}`);
  revalidatePath("/admin/reports");
  return { ok: true };
}

/** Empty select value means "not set", which is a legitimate answer. */
function areaIdFrom(formData: FormData): string | null {
  const raw = formData.get("areaId");
  return typeof raw === "string" && raw ? raw : null;
}
