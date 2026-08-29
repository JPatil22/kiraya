import type { BhkType, PropertyPhoto, RoomType } from "@/types/database";

/**
 * Room slots for a listing — the TS twin of `bedrooms_for_bhk` /
 * `rooms_required_for_bhk` in migration 0008. Keep the two in step.
 *
 * The point of slots: a listing owes a photo of each room its configuration
 * implies. Coverage is then a trust signal — "4 of 5 rooms shown" says plainly
 * what is being left out, the same way the freshness stamp does.
 */

/** A 1RK's single room IS its hall, so it owes no separate bedroom. */
export const BEDROOMS_FOR_BHK: Record<BhkType, number> = {
  "1rk": 0,
  "1bhk": 1,
  "2bhk": 2,
  "3bhk": 3,
  "4plus": 4,
};

/**
 * Bathrooms a configuration is expected to have — an Indian 2BHK almost always
 * has two. Twin of `bathrooms_for_bhk` in migration 0036; keep the two in step.
 */
export const BATHROOMS_FOR_BHK: Record<BhkType, number> = {
  "1rk": 1,
  "1bhk": 1,
  "2bhk": 2,
  "3bhk": 2,
  "4plus": 3,
};

/** Labelled extras — allowed, but they don't count toward coverage. */
export const OPTIONAL_ROOMS: RoomType[] = ["balcony", "exterior"];

export type RoomSlot = {
  roomType: RoomType;
  roomIndex: number;
  label: string;
  /** Required slots are what `rooms_required` counts. */
  required: boolean;
};

export const ROOM_LABEL: Record<RoomType, string> = {
  hall: "Hall / living room",
  kitchen: "Kitchen",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  balcony: "Balcony",
  exterior: "Building / entrance",
};

/**
 * Every slot a listing of this configuration can fill, required ones first and
 * in the order a tenant would want to see them.
 */
export function slotsForBhk(bhk: BhkType): RoomSlot[] {
  const bedrooms = BEDROOMS_FOR_BHK[bhk];

  const slots: RoomSlot[] = [
    {
      roomType: "hall",
      roomIndex: 1,
      // For a 1RK the hall is the whole room; say so rather than mislabel it.
      label: bhk === "1rk" ? "The room" : ROOM_LABEL.hall,
      required: true,
    },
    { roomType: "kitchen", roomIndex: 1, label: ROOM_LABEL.kitchen, required: true },
  ];

  for (let i = 1; i <= bedrooms; i += 1) {
    slots.push({
      roomType: "bedroom",
      roomIndex: i,
      label: bedrooms === 1 ? "Bedroom" : `Bedroom ${i}`,
      required: true,
    });
  }

  const bathrooms = BATHROOMS_FOR_BHK[bhk];
  for (let i = 1; i <= bathrooms; i += 1) {
    slots.push({
      roomType: "bathroom",
      roomIndex: i,
      label: bathrooms === 1 ? ROOM_LABEL.bathroom : `${ROOM_LABEL.bathroom} ${i}`,
      required: true,
    });
  }

  for (const roomType of OPTIONAL_ROOMS) {
    slots.push({ roomType, roomIndex: 1, label: ROOM_LABEL[roomType], required: false });
  }

  return slots;
}

export const roomsRequiredForBhk = (bhk: BhkType): number =>
  2 + BEDROOMS_FOR_BHK[bhk] + BATHROOMS_FOR_BHK[bhk];

/** Label for a photo already assigned to a slot. */
export function photoRoomLabel(roomType: RoomType, roomIndex: number, bhk?: BhkType): string {
  if (roomType === "hall" && bhk === "1rk") return "The room";
  if (roomType === "bedroom") {
    const bedrooms = bhk ? BEDROOMS_FOR_BHK[bhk] : 2;
    return bedrooms === 1 ? "Bedroom" : `Bedroom ${roomIndex}`;
  }
  if (roomType === "bathroom") {
    const bathrooms = bhk ? BATHROOMS_FOR_BHK[bhk] : 1;
    return bathrooms === 1 ? "Bathroom" : `Bathroom ${roomIndex}`;
  }
  return ROOM_LABEL[roomType];
}

const slotKey = (roomType: RoomType, roomIndex: number) => `${roomType}:${roomIndex}`;

/** Pair each slot with its photo, if one has been uploaded. */
export function slotsWithPhotos(
  bhk: BhkType,
  photos: PropertyPhoto[],
): { slot: RoomSlot; photo: PropertyPhoto | null }[] {
  const byKey = new Map(photos.map((p) => [slotKey(p.room_type, p.room_index), p]));
  return slotsForBhk(bhk).map((slot) => ({
    slot,
    photo: byKey.get(slotKey(slot.roomType, slot.roomIndex)) ?? null,
  }));
}

/** Required slots still missing a photo — the honest gap in a listing. */
export function missingRooms(bhk: BhkType, photos: PropertyPhoto[]): RoomSlot[] {
  return slotsWithPhotos(bhk, photos)
    .filter(({ slot, photo }) => slot.required && !photo)
    .map(({ slot }) => slot);
}
