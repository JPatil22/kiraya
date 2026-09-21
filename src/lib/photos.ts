import type { SupabaseClient } from "@supabase/supabase-js";
import { USE_FIXTURES } from "@/lib/open-mode";
import type { Database, PropertyPhoto, RoomType } from "@/types/database";
import { logRead } from "@/lib/errors";
import { BEDROOMS_FOR_BHK, BATHROOMS_FOR_BHK } from "@/lib/rooms";

/** The public Storage bucket created in migration 0006. */
export const PHOTO_BUCKET = "listing-photos";

/**
 * Ceiling on photos per listing. High enough to cover the largest room set — a
 * 4+ BHK owes hall + kitchen + 4 bedrooms + 3 bathrooms = 9 required, plus the
 * two optional extras (balcony, exterior) — with a little headroom.
 */
export const MAX_PHOTOS = 12;
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
  if (data && data.length > 0) {
    return data;
  }

  // Safety fallback: If property_photos is empty, attempt to read from ingest_photos
  // so photos are never completely missing if someone views a listing before slots are finalized
  const { data: staged } = await supabase
    .from("ingest_photos")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (staged && staged.length > 0) {
    return staged.map((s, idx) => ({
      id: s.id,
      property_id: s.property_id,
      storage_path: s.storage_path,
      thumbnail_path: s.thumbnail_path,
      caption: null,
      sort_order: idx,
      captured_at: null,
      room_type: (idx === 0 ? "hall" : idx === 1 ? "bedroom" : "exterior") as RoomType,
      room_index: 1,
      created_by: s.created_by,
      created_at: s.created_at,
    }));
  }

  return [];
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
  // A taken-date is no longer asked for — a photo carries its upload date — so a
  // missing captured_at is normal, not a mismatch to warn about. The genuine
  // "this photo is far older than the listing" checks below still run whenever a
  // real capture date is present.
  if (!capturedAt) return null;

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

/** Batch query photo counts for a list of properties. */
export async function getPhotoCountsForProperties(
  supabase: SupabaseClient<Database>,
  propertyIds: string[],
): Promise<Record<string, number>> {
  if (propertyIds.length === 0) return {};
  const { data, error } = await supabase
    .from("property_photos")
    .select("property_id")
    .in("property_id", propertyIds);
  logRead("getPhotoCountsForProperties", error);

  const counts: Record<string, number> = {};
  for (const id of propertyIds) {
    counts[id] = 0;
  }
  for (const row of data ?? []) {
    if (row.property_id) {
      counts[row.property_id] = (counts[row.property_id] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Auto-promote staged photos to valid room slots when a listing is approved.
 * This ensures approved listings immediately show photos on the live site
 * without requiring the admin to manually tag every single photo slot.
 */
export async function autoPromoteStagedPhotos(
  supabase: SupabaseClient<Database>,
  propertyId: string,
  userId?: string,
): Promise<number> {
  const { data: prop } = await supabase
    .from("properties")
    .select("id, bhk, posted_by")
    .eq("id", propertyId)
    .maybeSingle();
  if (!prop) return 0;

  const { data: staged } = await supabase
    .from("ingest_photos")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });

  if (!staged || staged.length === 0) return 0;

  const { data: existing } = await supabase
    .from("property_photos")
    .select("room_type, room_index, sort_order")
    .eq("property_id", propertyId);

  const occupied = new Set((existing ?? []).map((p) => `${p.room_type}:${p.room_index}`));

  const bedrooms = BEDROOMS_FOR_BHK[prop.bhk] ?? 2;
  const bathrooms = BATHROOMS_FOR_BHK[prop.bhk] ?? 2;
  const candidateSlots: { roomType: RoomType; roomIndex: number }[] = [
    { roomType: "hall", roomIndex: 1 },
  ];
  for (let i = 1; i <= bedrooms; i++) {
    candidateSlots.push({ roomType: "bedroom", roomIndex: i });
  }
  candidateSlots.push({ roomType: "kitchen", roomIndex: 1 });
  for (let i = 1; i <= bathrooms; i++) {
    candidateSlots.push({ roomType: "bathroom", roomIndex: i });
  }
  candidateSlots.push({ roomType: "balcony", roomIndex: 1 });
  candidateSlots.push({ roomType: "exterior", roomIndex: 1 });

  const availableSlots = candidateSlots.filter(
    (s) => !occupied.has(`${s.roomType}:${s.roomIndex}`)
  );

  const toInsert = [];
  const stagedIdsToDelete = [];
  const countToPromote = Math.min(staged.length, availableSlots.length);
  const startSortOrder = (existing ?? []).reduce((max, p) => Math.max(max, p.sort_order), -1) + 1;

  for (let i = 0; i < countToPromote; i++) {
    const s = staged[i];
    const slot = availableSlots[i];
    toInsert.push({
      property_id: propertyId,
      storage_path: s.storage_path,
      thumbnail_path: s.thumbnail_path,
      room_type: slot.roomType,
      room_index: slot.roomIndex,
      sort_order: startSortOrder + i,
      captured_at: null,
      created_by: prop.posted_by ?? userId ?? "",
    });
    stagedIdsToDelete.push(s.id);
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("property_photos").insert(toInsert);
    if (insertErr) {
      console.error("autoPromoteStagedPhotos insert error:", insertErr.message);
      return 0;
    }
    await supabase.from("ingest_photos").delete().in("id", stagedIdsToDelete);
    return toInsert.length;
  }
  return 0;
}

