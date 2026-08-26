"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import { loadGoogleMaps } from "@/lib/maps";

/**
 * Where it is, on the listing page (0027) — Google build.
 *
 * Read-only and quiet: one pin, and a directions link, because the reason any
 * of this exists is the wasted Saturday and the last step of not wasting one is
 * knowing how far it actually is from you.
 */

export function GoogleLocationMap({
  latitude,
  longitude,
  title,
}: {
  latitude: number;
  longitude: number;
  title: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Split for the same reason as the picker: building inside `.then()` lets a
  // development remount cancel the build and leave an empty box behind.
  useEffect(() => {
    let live = true;
    loadGoogleMaps()
      .then(() => {
        if (live) setReady(true);
      })
      .catch((error: Error) => {
        if (live) setFailed(error.message);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !container.current || map.current) return;
    const position = { lat: latitude, lng: longitude };

    map.current = new google.maps.Map(container.current, {
      center: position,
      zoom: 17,
      mapTypeId: "hybrid",
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    new google.maps.Marker({ position, map: map.current, title });
  }, [ready, latitude, longitude, title]);

  return (
    <div className="space-y-2">
      <div
        ref={container}
        className="h-64 w-full overflow-hidden rounded-lg border bg-muted"
        role="application"
        aria-label={`Map showing the location of ${title}`}
      />
      {failed ? (
        <p className="text-xs text-muted-foreground">
          The map couldn&apos;t load, but the directions link still works.
        </p>
      ) : null}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2 hover:text-foreground"
      >
        <Navigation className="size-3.5" />
        Directions — check the commute before you travel
      </a>
    </div>
  );
}
