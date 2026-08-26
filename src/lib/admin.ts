import type { SupabaseClient } from "@supabase/supabase-js";
import { OPEN_MODE, USE_FIXTURES } from "@/lib/open-mode";
import type {
  Database,
  LocalityHealth,
  MismatchReport,
  ModerationKind,
  Profile,
  Property,
} from "@/types/database";
import { logRead } from "@/lib/errors";

/**
 * MVP5 — the operator's cockpit.
 *
 * ## Why these actions aren't always `supabase.rpc(...)`
 *
 * Migration 0005 ships five SECURITY DEFINER RPCs that self-gate on
 * `is_admin()`, which reads `auth.uid()` from the caller's JWT. That is the
 * right design and stays the source of truth in production.
 *
 * But open mode has no JWT: it talks to Postgres with the service-role key, so
 * `auth.uid()` is null, `is_admin()` returns false, and every one of those RPCs
 * would raise `not authorized`. Fixture mode has no Postgres at all.
 *
 * So each action below has two paths that must stay in step:
 *   • authenticated → call the RPC, and let the database decide
 *   • sandbox       → perform the equivalent writes directly
 *
 * The SQL is the spec. If you change an RPC in 0005, change its twin here.
 */

const SANDBOX = USE_FIXTURES || OPEN_MODE;

type Client = SupabaseClient<Database>;

/** Mirrors the `moderation_actions` insert every RPC in 0005 performs. */
async function logModeration(
  supabase: Client,
  adminId: string,
  targetTable: string,
  targetId: string,
  kind: ModerationKind,
  note: string | null,
) {
  await supabase.from("moderation_actions").insert({
    admin_id: adminId,
    target_table: targetTable,
    target_id: targetId,
    kind,
    note,
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getLocalityHealth(
  supabase: Client,
  slug: string,
): Promise<LocalityHealth | null> {
  const { data, error } = await supabase
    .from("v_locality_health")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  logRead("getLocalityHealth", error);
  return data;
}

/** Listings waiting on a decision. */
export async function getReviewQueue(
  supabase: Client,
  localityId: string,
): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("locality_id", localityId)
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });
  logRead("getReviewQueue", error);
  return data ?? [];
}

/** Live listings, oldest verification first — the re-verification worklist. */
export async function getLiveListings(
  supabase: Client,
  localityId: string,
): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("locality_id", localityId)
    .eq("status", "live")
    .order("last_verified_at", { ascending: true, nullsFirst: true });
  logRead("getLiveListings", error);
  return data ?? [];
}

export async function getOpenReports(supabase: Client): Promise<MismatchReport[]> {
  const { data, error } = await supabase
    .from("mismatch_reports")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: true });
  logRead("getOpenReports", error);
  return data ?? [];
}

/** Everyone who can post — the broker-management list. */
export async function getPosters(supabase: Client): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("role", "tenant")
    .order("created_at", { ascending: true });
  logRead("getPosters", error);
  return (data ?? []).filter((p) => p.role !== null);
}

// ---------------------------------------------------------------------------
// Actions — each mirrors the same-named RPC in migration 0005
// ---------------------------------------------------------------------------

/** approve → live + verification stamp · reject → rejected. */
export async function reviewListing(
  supabase: Client,
  adminId: string,
  propertyId: string,
  approve: boolean,
  note: string | null,
): Promise<string | null> {
  if (!SANDBOX) {
    const { error } = await supabase.rpc("admin_review_listing", {
      p_property: propertyId,
      p_approve: approve,
      p_note: note,
    });
    return error?.message ?? null;
  }

  const patch = approve
    ? { status: "live" as const, last_verified_at: new Date().toISOString(), last_verified_by: adminId }
    : { status: "rejected" as const };

  const { error } = await supabase.from("properties").update(patch).eq("id", propertyId);
  if (error) return error.message;

  await logModeration(
    supabase,
    adminId,
    "properties",
    propertyId,
    approve ? "approve" : "reject",
    note,
  );
  return null;
}

/** Re-stamp freshness on a live listing. */
export async function verifyListing(
  supabase: Client,
  adminId: string,
  propertyId: string,
  note: string | null,
): Promise<string | null> {
  if (!SANDBOX) {
    const { error } = await supabase.rpc("admin_verify_listing", {
      p_property: propertyId,
      p_note: note,
    });
    return error?.message ?? null;
  }

  const { error } = await supabase
    .from("properties")
    .update({ last_verified_at: new Date().toISOString(), last_verified_by: adminId })
    .eq("id", propertyId);
  if (error) return error.message;

  await logModeration(supabase, adminId, "properties", propertyId, "verify", note);
  return null;
}

/** Pull a listing out of the feed. */
export async function takedownListing(
  supabase: Client,
  adminId: string,
  propertyId: string,
  note: string | null,
): Promise<string | null> {
  if (!SANDBOX) {
    const { error } = await supabase.rpc("admin_takedown_listing", {
      p_property: propertyId,
      p_note: note,
    });
    return error?.message ?? null;
  }

  const { error } = await supabase
    .from("properties")
    .update({ status: "archived" })
    .eq("id", propertyId);
  if (error) return error.message;

  await logModeration(supabase, adminId, "properties", propertyId, "takedown", note);
  return null;
}

/** Close a mismatch report: resolved (it was true) or dismissed (it wasn't). */
export async function resolveReport(
  supabase: Client,
  adminId: string,
  reportId: string,
  resolve: boolean,
  note: string | null,
): Promise<string | null> {
  if (!SANDBOX) {
    const { error } = await supabase.rpc("admin_resolve_report", {
      p_report: reportId,
      p_resolve: resolve,
      p_note: note,
    });
    return error?.message ?? null;
  }

  const { error } = await supabase
    .from("mismatch_reports")
    .update({
      status: resolve ? "resolved" : "dismissed",
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (error) return error.message;

  await logModeration(
    supabase,
    adminId,
    "mismatch_reports",
    reportId,
    resolve ? "resolve_report" : "dismiss_report",
    note,
  );
  return null;
}

/** Suspend or reinstate a poster. */
export async function setSuspended(
  supabase: Client,
  adminId: string,
  userId: string,
  suspended: boolean,
  note: string | null,
): Promise<string | null> {
  if (!SANDBOX) {
    const { error } = await supabase.rpc("admin_set_suspended", {
      p_user: userId,
      p_suspended: suspended,
      p_note: note,
    });
    return error?.message ?? null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_suspended: suspended })
    .eq("id", userId);
  if (error) return error.message;

  await logModeration(
    supabase,
    adminId,
    "profiles",
    userId,
    suspended ? "suspend_user" : "reinstate_user",
    note,
  );
  return null;
}
