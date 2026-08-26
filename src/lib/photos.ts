import type { SupabaseClient } from "@supabase/supabase-js";
import { USE_FIXTURES } from "@/lib/open-mode";
import type { Database, PropertyPhoto } from "@/types/database";
import { logRead } from "@/lib/errors";

/** The public Storage bucket created in migration 0006. */
export const PHOTO_BUCKET = "listing-photos";

/** Matches the bucket's own limits, so the UI rejects before the upload does. */
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];

/**
 * Resolve a stored path to something an `<img>` can load.
 *
 * In fixture mode there is no Storage, so uploads are kept as data URLs in the
 * in-memory store and the "path" already is the src.
 */
export function photoUrl(storagePath: string): string {
  if (storagePath.startsWith("data:")) return storagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${storagePath}`;
}

export async function getPhotos(
  supabase: SupabaseClient<Database>,
  propertyId: string,
): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from("property_photos")
    .select("*")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: true });
  logRead("getPhotos", error);
  return data ?? [];
}

/**
 * How much older the photo is than the listing's last verification.
 *
 * This is the whole reason photos carry `captured_at`. "Verified 2 days ago"
 * next to a picture from two years ago is a mismatch the tenant deserves to
 * see before they travel across the city.
 */
export function photoAgeWarning(
  capturedAt: string | null,
  lastVerifiedAt: string | null,
): { label: string; stale: boolean } | null {
  if (!capturedAt) return { label: "Photo date not given", stale: true };

  const captured = Date.parse(capturedAt);
  if (Number.isNaN(captured)) return null;

  const monthsOld = (Date.now() - captured) / (30 * 86_400_000);
  // Six months is generous for a rental interior; past that, say so.
  const stale = monthsOld > 6;

  if (!lastVerifiedAt) {
    return stale ? { label: `Photo is ${Math.round(monthsOld)} months old`, stale } : null;
  }

  const verifiedMonthsAfter =
    (Date.parse(lastVerifiedAt) - captured) / (30 * 86_400_000);

  if (verifiedMonthsAfter > 6) {
    return {
      label: `Photo predates the last verification by ${Math.round(verifiedMonthsAfter)} months`,
      stale: true,
    };
  }

  return stale ? { label: `Photo is ${Math.round(monthsOld)} months old`, stale } : null;
}

/** Where a new object goes in the bucket. */
export function photoObjectKey(propertyId: string, fileName: string): string {
  const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${propertyId}/${id}.${ext || "jpg"}`;
}

/**
 * The thumbnail's key, derived from the full image's (0033). Kept next to it in
 * the same folder — `<id>/<uuid>.<ext>` → `<id>/<uuid>_thumb.jpg` — so the
 * folder-scoped storage RLS covers both, and always `.jpg` because the browser
 * re-encodes the small variant regardless of the source format.
 */
export function thumbObjectKey(fullKey: string): string {
  return fullKey.replace(/\.[^./]+$/, "") + "_thumb.jpg";
}

/** Fixture mode keeps bytes inline; everything else goes to Storage. */
export const PHOTOS_INLINE = USE_FIXTURES;
