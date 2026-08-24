"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import {
  resolveReport,
  reviewListing,
  setSuspended,
  takedownListing,
  verifyListing,
} from "@/lib/admin";

export type AdminState = { error?: string } | null;

/** Every admin action funnels through the same guard. */
async function requireAdmin() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { supabase, user: null, error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }
  if (user.role !== "admin") {
    return { supabase, user: null, error: "Admins only." };
  }
  return { supabase, user, error: null };
}

const note = (formData: FormData) => {
  const value = formData.get("note");
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
};

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/people");
  revalidatePath("/listings");
}

/** Approve (→ live + verified) or reject a pending listing. */
export async function reviewListingAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Admins only." };

  const propertyId = formData.get("propertyId");
  const approve = formData.get("decision") === "approve";
  if (typeof propertyId !== "string") return { error: "Missing listing." };

  const failure = await reviewListing(supabase, user.id, propertyId, approve, note(formData));
  if (failure) return { error: failure };

  refresh();
  revalidatePath(`/listings/${propertyId}`);
  return null;
}

/** Re-stamp freshness, or pull the listing entirely. */
export async function listingMaintenanceAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Admins only." };

  const propertyId = formData.get("propertyId");
  const action = formData.get("action");
  if (typeof propertyId !== "string") return { error: "Missing listing." };

  const failure =
    action === "takedown"
      ? await takedownListing(supabase, user.id, propertyId, note(formData))
      : await verifyListing(supabase, user.id, propertyId, note(formData));
  if (failure) return { error: failure };

  refresh();
  revalidatePath(`/listings/${propertyId}`);
  return null;
}

/** Close a mismatch report as resolved (true) or dismissed (not true). */
export async function resolveReportAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Admins only." };

  const reportId = formData.get("reportId");
  const resolve = formData.get("decision") === "resolve";
  if (typeof reportId !== "string") return { error: "Missing report." };

  const failure = await resolveReport(supabase, user.id, reportId, resolve, note(formData));
  if (failure) return { error: failure };

  refresh();
  return null;
}

/** Suspend or reinstate an owner/broker. */
export async function setSuspendedAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { error: error ?? "Admins only." };

  const userId = formData.get("userId");
  const suspended = formData.get("suspended") === "true";
  if (typeof userId !== "string") return { error: "Missing user." };
  if (userId === user.id) return { error: "You can't suspend yourself." };

  const failure = await setSuspended(supabase, user.id, userId, suspended, note(formData));
  if (failure) return { error: failure };

  refresh();
  return null;
}
