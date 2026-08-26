/**
 * The pinned location (0027) — the app-side twin of the
 * `properties_location_pair` constraint.
 *
 * The rule the database enforces is "both or neither": half a coordinate is a
 * broken row rather than a partly-known place. Not pinning at all stays
 * legitimate, and the UI says so instead of dropping a marker somewhere
 * plausible, on the same principle that an unverified listing says "never
 * confirmed" rather than showing today's date.
 */

export type ParsedLocation =
  | { ok: true; latitude: number | null; longitude: number | null }
  | { ok: false; message: string };

export function parseLocation(
  rawLat: FormDataEntryValue | null,
  rawLng: FormDataEntryValue | null,
): ParsedLocation {
  const lat = toNumber(rawLat);
  const lng = toNumber(rawLng);

  if (lat === null && lng === null) return { ok: true, latitude: null, longitude: null };

  if (lat === null || lng === null) {
    return { ok: false, message: "That pin didn't save properly. Place it on the map again." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, message: "That pin isn't a real place on earth. Try again." };
  }

  // Six decimals is roughly 11cm — well past what a dragged pin can express,
  // and what the numeric(9,6) column stores.
  return { ok: true, latitude: round6(lat), longitude: round6(lng) };
}

function toNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Coordinates arrive from Postgres `numeric` as strings often enough to matter. */
export function toCoords(
  latitude: number | string | null,
  longitude: number | string | null,
): { lat: number; lng: number } | null {
  const lat = typeof latitude === "string" ? Number.parseFloat(latitude) : latitude;
  const lng = typeof longitude === "string" ? Number.parseFloat(longitude) : longitude;
  if (lat === null || lng === null || lat === undefined || lng === undefined) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
