"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";

/**
 * Where it is, on the listing page (0027).
 *
 * Read-only and deliberately quiet: one pin, no controls to fiddle with, and a
 * directions link — because the reason this exists is the wasted Saturday, and
 * the last step of not wasting one is knowing how far it actually is from you.
 */
export function LocationMap({
  latitude,
  longitude,
  title,
}: {
  latitude: number;
  longitude: number;
  title: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<Leaflet.Map | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current || map.current) return;

      const instance = L.map(container.current, {
        scrollWheelZoom: false,
        // A listing page is scrolled, not panned. Dragging still works.
        zoomControl: true,
      }).setView([latitude, longitude], 16);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);

      L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: "",
          iconSize: [26, 26],
          iconAnchor: [13, 26],
          html: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="hsl(222.2 47.4% 11.2%)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="white"/>
            <circle cx="12" cy="10" r="3" fill="hsl(222.2 47.4% 11.2%)"/>
          </svg>`,
        }),
      })
        .addTo(instance)
        .bindPopup(title);

      map.current = instance;
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [latitude, longitude, title]);

  return (
    <div className="space-y-2">
      <div
        ref={container}
        className="h-64 w-full overflow-hidden rounded-lg border"
        role="application"
        aria-label={`Map showing the location of ${title}`}
      />
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
