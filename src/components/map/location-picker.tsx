"use client";

import { usingGoogleMaps } from "@/lib/maps";
import { GoogleLocationPicker } from "./google-location-picker";
import { OsmLocationPicker } from "./osm-location-picker";

/**
 * One pin control, two possible providers (0027).
 *
 * Whichever draws it, the output is the same pair of hidden inputs, so nothing
 * upstream — form, action, column, constraint — knows or cares which one ran.
 */
export function LocationPicker(props: {
  initialLat?: number | null;
  initialLng?: number | null;
  /** Centre of the chosen area (0028): where to open, and what to bias search to. */
  focus?: { lat: number; lng: number } | null;
}) {
  return usingGoogleMaps() ? <GoogleLocationPicker {...props} /> : <OsmLocationPicker {...props} />;
}
