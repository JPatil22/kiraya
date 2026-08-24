"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import {
  ACCEPTED_MIME,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PHOTOS_INLINE,
  PHOTO_BUCKET,
  photoObjectKey,
} from "@/lib/photos";
import { ROOM_LABEL } from "@/lib/rooms";
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
  revalidatePath("/listings");
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

  let storagePath: string;
  if (PHOTOS_INLINE) {
    // No Storage in fixture mode — keep the bytes inline.
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    storagePath = `data:${file.type};base64,${bytes}`;
  } else {
    storagePath = photoObjectKey(propertyId, file.name);
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) return { error: uploadError.message };
  }

  const cleanupUpload = async () => {
    if (!PHOTOS_INLINE) await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  };

  if (occupying) {
    const { error: updateError } = await supabase
      .from("property_photos")
      .update({ storage_path: storagePath, captured_at: capturedAt, created_by: user.id })
      .eq("id", occupying.id);
    if (updateError) {
      await cleanupUpload();
      return { error: updateError.message };
    }
    // The slot's old image is now unreferenced.
    if (!PHOTOS_INLINE && !occupying.storage_path.startsWith("data:")) {
      await supabase.storage.from(PHOTO_BUCKET).remove([occupying.storage_path]);
    }
    refresh(propertyId);
    return { ok: "Photo replaced." };
  }

  const { error: insertError } = await supabase.from("property_photos").insert({
    property_id: propertyId,
    storage_path: storagePath,
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
    await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  }

  refresh(propertyId);
  return { ok: "Photo removed." };
}

// Manual reordering is gone: with one photo per room slot, the canonical room
// order (hall → kitchen → bedrooms → bathroom → extras) IS the order, and the
// hall leads as the cover shot. See slotsForBhk() in src/lib/rooms.ts.
