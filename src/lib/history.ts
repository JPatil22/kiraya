import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import {
  AVAILABILITY_OPTIONS,
  FURNISHING_OPTIONS,
  LISTING_STATUS,
  MONEY_FIELDS,
  OCCUPANCY_OPTIONS,
  UPDATE_FIELD_LABEL,
  labelFor,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import type {
  AvailabilityStatus,
  Database,
  FurnishingType,
  ListingStatus,
  MismatchReport,
  OccupancyType,
  PropertyUpdate,
  UserRole,
} from "@/types/database";

/**
 * MVP3 — the trust layer. `property_updates` is written by the 0003 trigger on
 * every meaningful change, so this reads a log the app never gets to author.
 */

/** Newest-first change log for a listing. */
export async function getPropertyUpdates(
  supabase: SupabaseClient<Database>,
  propertyId: string,
  limit = 25,
): Promise<PropertyUpdate[]> {
  const { data } = await supabase
    .from("property_updates")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * The viewer's own open report on a listing, if any. The DB allows exactly one
 * (partial unique index in 0003), so this drives "you've already reported this".
 */
export async function getMyOpenReport(
  supabase: SupabaseClient<Database>,
  propertyId: string,
  userId: string,
): Promise<MismatchReport | null> {
  const { data } = await supabase
    .from("mismatch_reports")
    .select("*")
    .eq("property_id", propertyId)
    .eq("reported_by", userId)
    .eq("status", "open")
    .maybeSingle();
  return data;
}

/** Render a logged value the way the rest of the UI would show that column. */
export function formatUpdateValue(field: string, value: string | null): string {
  if (value === null || value === "") return "—";

  if (MONEY_FIELDS.has(field)) {
    const n = Number(value);
    return Number.isFinite(n) ? formatINR(n) : value;
  }

  switch (field) {
    case "availability":
      return labelFor(AVAILABILITY_OPTIONS, value as AvailabilityStatus);
    case "furnishing":
      return labelFor(FURNISHING_OPTIONS, value as FurnishingType);
    case "occupancy_pref":
      return labelFor(OCCUPANCY_OPTIONS, value as OccupancyType);
    case "status":
      return LISTING_STATUS[value as ListingStatus]?.label ?? value;
    case "available_from":
    case "last_verified_at": {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? value : format(new Date(parsed), "d MMM yyyy");
    }
    default:
      return value;
  }
}

export function formatUpdateField(field: string): string {
  return UPDATE_FIELD_LABEL[field] ?? field.replace(/_/g, " ");
}

/**
 * Who made the change, without leaking PII.
 *
 * A tenant can read `property_updates` for any live listing but cannot read
 * other people's `profiles` rows — so there is no name to show. Comparing
 * against the listing's own poster tells us all we're allowed to say: the
 * poster changed it, or Kiraya (an admin) did.
 */
export function updateAuthor(
  changedBy: string | null,
  postedBy: string,
  postedByRole: UserRole | null,
): string {
  if (!changedBy) return "System";
  if (changedBy === postedBy) return postedByRole === "broker" ? "the broker" : "the owner";
  return "Kiraya";
}
