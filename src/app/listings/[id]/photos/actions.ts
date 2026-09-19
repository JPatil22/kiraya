"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { LISTINGS_CACHE_TAG } from "@/lib/listings";
import { OPEN_MODE } from "@/lib/open-mode";
import {
  ACCEPTED_MIME,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PHOTOS_INLINE,
  PHOTO_BUCKET,
  photoObjectKey,
  thumbObjectKey,
} from "@/lib/photos";
import { ROOM_LABEL, slotsForBhk } from "@/lib/rooms";
import type { RoomType } from "@/types/database";

export type PhotoState = { error?: string; ok?: string } | null;

function isRoomType(value: FormDataEntryValue | null): value is RoomType {
  return typeof value === "string" && value in ROOM_LABEL;
}

/** Only the listing's poster (or an admin) may touch its gallery. */
async function requirePoster(propertyId: string) {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return { supabase, user: null, error: "Open mode isn't seeded yet — run `npm run db:seed`." };
  }

  const { data: property } = await supabase
    .from("properties")
    .select("posted_by")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) return { supabase, user: null, error: "That listing doesn't exist." };
  if (property.posted_by !== user.id && user.role !== "admin") {
    return { supabase, user: null, error: "That isn't your listing." };
  }

  return { supabase, user, error: null };
}

function refresh(propertyId: string) {
  revalidatePath(`/listings/${propertyId}/photos`);
  revalidatePath(`/listings/${propertyId}`);
  revalidatePath(`/admin/listings/${propertyId}`);
  revalidatePath("/admin/listings");
  revalidatePath("/listings");
  revalidateTag(LISTINGS_CACHE_TAG);
}

/**
 * Upload one or more photos.
 *
 * Files come through the server action rather than a browser-side Storage call
 * so the one code path works in all three modes — with a real session, in open
 * mode (no JWT, service-role client) and on fixtures (no Storage at all, bytes
 * kept inline as data URLs).
 */
export async function uploadPhotos(
  _prev: PhotoState,
  formData: FormData,
): Promise<PhotoState> {
  const propertyId = formData.get("propertyId");
  if (typeof propertyId !== "string") return { error: "Missing listing." };

  const { supabase, user, error } = await requirePoster(propertyId);
  if (error || !user) return { error: error ?? "Not allowed." };

  // Every photo claims a room slot — that's what stops a listing being padded
  // with eight angles of the same living room. Validated again by 0008.
  const roomType = formData.get("roomType");
  const roomIndex = Number(formData.get("roomIndex") ?? 1);
  if (!isRoomType(roomType)) return { error: "Pick which room this shows." };
  if (!Number.isInteger(roomIndex) || roomIndex < 1 || roomIndex > 4) {
    return { error: "Invalid room number." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick an image." };
  if (!ACCEPTED_MIME.includes(file.type)) return { error: "Only JPEG, PNG or WebP." };
  if (file.size > MAX_PHOTO_BYTES) return { error: `${file.name} is over 5 MB.` };

  const capturedRaw = formData.get("capturedAt");
  const capturedAt = typeof capturedRaw === "string" && capturedRaw ? capturedRaw : null;
  if (capturedAt && Date.parse(capturedAt) > Date.now()) {
    return { error: "A photo can't have been taken in the future." };
  }

  const { data: existing } = await supabase
    .from("property_photos")
    .select("*")
    .eq("property_id", propertyId);
  const current = existing ?? [];

  // Re-shooting a room replaces it rather than stacking a duplicate.
  const occupying = current.find(
    (p) => p.room_type === roomType && p.room_index === roomIndex,
  );
  if (!occupying && current.length >= MAX_PHOTOS) {
    return { error: `A listing can have at most ${MAX_PHOTOS} photos.` };
  }

  // The browser sends a card-sized copy alongside the full image (0033). It is
  // validated like the real thing but never required — a missing or malformed
  // thumbnail just means the feed falls back to the full image.
  const thumbFile = formData.get("thumbnail");
  const hasThumb =
    thumbFile instanceof File &&
    thumbFile.size > 0 &&
    thumbFile.size <= MAX_PHOTO_BYTES &&
    ACCEPTED_MIME.includes(thumbFile.type);

  let storagePath: string;
  let thumbnailPath: string | null = null;
  if (PHOTOS_INLINE) {
    // No Storage in fixture mode — keep the bytes inline.
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    storagePath = `data:${file.type};base64,${bytes}`;
    if (hasThumb) {
      const tbytes = Buffer.from(await thumbFile.arrayBuffer()).toString("base64");
      thumbnailPath = `data:${thumbFile.type};base64,${tbytes}`;
    }
  } else {
    storagePath = photoObjectKey(propertyId, file.name);
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) return { error: uploadError.message };

    if (hasThumb) {
      const thumbKey = thumbObjectKey(storagePath);
      const { error: thumbError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(thumbKey, thumbFile, { contentType: thumbFile.type, upsert: false });
      // Optimisation, not a gate: on failure the listing still goes up.
      if (!thumbError) thumbnailPath = thumbKey;
    }
  }

  const cleanupUpload = async () => {
    if (PHOTOS_INLINE) return;
    const keys = thumbnailPath ? [storagePath, thumbnailPath] : [storagePath];
    await supabase.storage.from(PHOTO_BUCKET).remove(keys);
  };

  if (occupying) {
    const { error: updateError } = await supabase
      .from("property_photos")
      .update({
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        captured_at: capturedAt,
        created_by: user.id,
      })
      .eq("id", occupying.id);
    if (updateError) {
      await cleanupUpload();
      return { error: updateError.message };
    }
    // The slot's old image and its thumbnail are now unreferenced.
    if (!PHOTOS_INLINE && !occupying.storage_path.startsWith("data:")) {
      const stale = [occupying.storage_path];
      if (occupying.thumbnail_path && !occupying.thumbnail_path.startsWith("data:")) {
        stale.push(occupying.thumbnail_path);
      }
      await supabase.storage.from(PHOTO_BUCKET).remove(stale);
    }
    refresh(propertyId);
    return { ok: "Photo replaced." };
  }

  const { error: insertError } = await supabase.from("property_photos").insert({
    property_id: propertyId,
    storage_path: storagePath,
    thumbnail_path: thumbnailPath,
    room_type: roomType,
    room_index: roomIndex,
    sort_order: current.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1,
    captured_at: capturedAt,
    created_by: user.id,
  });

  if (insertError) {
    // Don't leave an orphaned object behind if the row fails.
    await cleanupUpload();
    return { error: insertError.message };
  }

  refresh(propertyId);
  return { ok: "Photo added." };
}

export async function deletePhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const propertyId = formData.get("propertyId");
  const photoId = formData.get("photoId");
  if (typeof propertyId !== "string" || typeof photoId !== "string") {
    return { error: "Missing photo." };
  }

  const { supabase, user, error } = await requirePoster(propertyId);
  if (error || !user) return { error: error ?? "Not allowed." };

  const { data: photo } = await supabase
    .from("property_photos")
    .select("*")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { error: "That photo is already gone." };

  const { error: deleteError } = await supabase
    .from("property_photos")
    .delete()
    .eq("id", photoId);
  if (deleteError) return { error: deleteError.message };

  if (!PHOTOS_INLINE && !photo.storage_path.startsWith("data:")) {
    const keys = [photo.storage_path];
    if (photo.thumbnail_path && !photo.thumbnail_path.startsWith("data:")) {
      keys.push(photo.thumbnail_path);
    }
    await supabase.storage.from(PHOTO_BUCKET).remove(keys);
  }

  refresh(propertyId);
  return { ok: "Photo removed." };
}

// Manual reordering is gone: with one photo per room slot, the canonical room
// order (hall → kitchen → bedrooms → bathroom → extras) IS the order, and the
// hall leads as the cover shot. See slotsForBhk() in src/lib/rooms.ts.

// ---------------------------------------------------------------------------
// Staged (scraped) photos — the "from the source post" pile that /api/ingest
// drops into ingest_photos. Assigning one promotes it into a real
// property_photos row reusing the same storage object (never re-uploaded);
// discarding one deletes the row and its object. See migration 0037.
// ---------------------------------------------------------------------------

/**
 * Tag a staged photo with a room, turning it into a real listing photo. The
 * scraped bytes already live in the bucket, so this just creates (or replaces)
 * the property_photos row pointing at the same object, then drops the staging
 * row. captured_at is left null: nobody knows when a scraped photo was taken,
 * and stamping "today" would fake a freshness the image doesn't have.
 */
export async function assignStagedPhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const propertyId = formData.get("propertyId");
  const stagedId = formData.get("stagedId");
  const slotKey = formData.get("slotKey");
  if (typeof propertyId !== "string" || typeof stagedId !== "string") {
    return { error: "Missing photo." };
  }
  if (typeof slotKey !== "string" || !slotKey.includes(":")) {
    return { error: "Pick which room this shows." };
  }

  const { supabase, user, error } = await requirePoster(propertyId);
  if (error || !user) return { error: error ?? "Not allowed." };

  const [roomType, roomIndexRaw] = slotKey.split(":");
  const roomIndex = Number(roomIndexRaw);
  if (!isRoomType(roomType) || !Number.isInteger(roomIndex)) {
    return { error: "Pick a valid room." };
  }

  // The slot has to be one this listing's configuration actually has.
  const { data: property } = await supabase
    .from("properties")
    .select("bhk")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) return { error: "That listing doesn't exist." };
  const validSlot = slotsForBhk(property.bhk).some(
    (s) => s.roomType === roomType && s.roomIndex === roomIndex,
  );
  if (!validSlot) return { error: "That room isn't part of this listing." };

  const { data: staged } = await supabase
    .from("ingest_photos")
    .select("*")
    .eq("id", stagedId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!staged) return { error: "That photo is no longer waiting." };

  const { data: existing } = await supabase
    .from("property_photos")
    .select("*")
    .eq("property_id", propertyId);
  const current = existing ?? [];
  const occupying = current.find((p) => p.room_type === roomType && p.room_index === roomIndex);

  if (occupying) {
    const { error: updateError } = await supabase
      .from("property_photos")
      .update({
        storage_path: staged.storage_path,
        thumbnail_path: staged.thumbnail_path,
        captured_at: null,
        created_by: user.id,
      })
      .eq("id", occupying.id);
    if (updateError) return { error: updateError.message };

    // The slot's previous object is now unreferenced.
    if (!PHOTOS_INLINE && !occupying.storage_path.startsWith("data:")) {
      const stale = [occupying.storage_path];
      if (occupying.thumbnail_path && !occupying.thumbnail_path.startsWith("data:")) {
        stale.push(occupying.thumbnail_path);
      }
      await supabase.storage.from(PHOTO_BUCKET).remove(stale);
    }
  } else {
    if (current.length >= MAX_PHOTOS) {
      return { error: `A listing can have at most ${MAX_PHOTOS} photos.` };
    }
    const { error: insertError } = await supabase.from("property_photos").insert({
      property_id: propertyId,
      storage_path: staged.storage_path,
      thumbnail_path: staged.thumbnail_path,
      room_type: roomType,
      room_index: roomIndex,
      sort_order: current.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1,
      captured_at: null,
      created_by: user.id,
    });
    if (insertError) return { error: insertError.message };
  }

  // Object now belongs to the property_photos row — drop the staging row only,
  // never its storage.
  await supabase.from("ingest_photos").delete().eq("id", stagedId);

  refresh(propertyId);
  return { ok: "Photo added." };
}

/** Throw away a staged photo the poster doesn't want — row and object both. */
export async function discardStagedPhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const propertyId = formData.get("propertyId");
  const stagedId = formData.get("stagedId");
  if (typeof propertyId !== "string" || typeof stagedId !== "string") {
    return { error: "Missing photo." };
  }

  const { supabase, user, error } = await requirePoster(propertyId);
  if (error || !user) return { error: error ?? "Not allowed." };

  const { data: staged } = await supabase
    .from("ingest_photos")
    .select("*")
    .eq("id", stagedId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!staged) return { error: "That photo is already gone." };

  const { error: deleteError } = await supabase.from("ingest_photos").delete().eq("id", stagedId);
  if (deleteError) return { error: deleteError.message };

  if (!PHOTOS_INLINE && !staged.storage_path.startsWith("data:")) {
    const keys = [staged.storage_path];
    if (staged.thumbnail_path && !staged.thumbnail_path.startsWith("data:")) {
      keys.push(staged.thumbnail_path);
    }
    await supabase.storage.from(PHOTO_BUCKET).remove(keys);
  }

  refresh(propertyId);
  return { ok: "Photo discarded." };
}
