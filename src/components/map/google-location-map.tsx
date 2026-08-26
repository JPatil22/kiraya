"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { loadGoogleMaps, staticMapUrl } from "@/lib/maps";

/**
 * Where it is, on the listing page (0027) — Google build.
 *
 * Read-only and quiet: one pin, and a directions link, because the reason any
 * of this exists is the wasted Saturday and the last step of not wasting one is
 * knowing how far it actually is from you.
 *
 * It opens as a still picture, not the live SDK. The interactive map is half a
 * megabyte of JavaScript and bills as a Dynamic Map on every view; most tenants
 * only need to see which building and roughly where, which a picture with a pin
 * shows for the price of one Static Maps request. The real map — draggable,
 * Street View, hybrid toggle — loads the moment someone clicks, and not before.
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

  // Nothing loads the SDK until the reader asks for it. `activated` is that ask;
  // `staticFailed` covers the Static Maps API not being enabled, in which case
  // we skip straight to the interactive map rather than showing a broken image.
  const [activated, setActivated] = useState(false);
  const [staticFailed, setStaticFailed] = useState(false);

  // Split for the same reason as the picker: building inside `.then()` lets a
  // development remount cancel the build and leave an empty box behind.
  useEffect(() => {
    if (!activated) return;
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
  }, [activated]);

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

  // Before activation: a still image the reader can click to make live. If the
  // Static Maps API isn't enabled the image errors, and we drop the facade and
  // activate immediately so there is always a working map, never a broken box.
  const showStatic = !activated && !staticFailed;

  return (
    <div className="space-y-2">
      {showStatic ? (
        <button
          type="button"
          onClick={() => setActivated(true)}
          className="group relative block h-64 w-full overflow-hidden rounded-lg border bg-muted"
          aria-label={`Show the interactive map for ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Google signs
              this URL; routing it through next/image would strip the query and
              404, and it is one small tile, not a gallery. */}
          <img
            src={staticMapUrl({ latitude, longitude })}
            alt={`Map showing the location of ${title}`}
            className="h-full w-full object-cover"
            onError={() => {
              setStaticFailed(true);
              setActivated(true);
            }}
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-background/85 py-1.5 text-xs font-medium backdrop-blur-sm transition group-hover:bg-background">
            <MapPin className="size-3.5" />
            Tap to explore — drag, zoom, Street View
          </span>
        </button>
      ) : (
        <div
          ref={container}
          className="h-64 w-full overflow-hidden rounded-lg border bg-muted"
          role="application"
          aria-label={`Map showing the location of ${title}`}
        />
      )}
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
