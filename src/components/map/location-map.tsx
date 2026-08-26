"use client";

import { usingGoogleMaps } from "@/lib/maps";
import { GoogleLocationMap } from "./google-location-map";
import { OsmLocationMap } from "./osm-location-map";

/** The listing page's map. Same seam as the picker. */
export function LocationMap(props: {
  latitude: number;
  longitude: number;
  title: string;
}) {
  return usingGoogleMaps() ? <GoogleLocationMap {...props} /> : <OsmLocationMap {...props} />;
}
