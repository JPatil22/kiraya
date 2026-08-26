"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Crosshair, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "leaflet/dist/leaflet.css";

/**
 * Pin the flat (0027).
 *
 * The point of this control is the to-and-fro it removes: a tenant deciding
 * whether a place is worth a Saturday should not have to make the trip to find
 * out which side of the highway it is on. That only works if the pin is where
 * the building is, so the affordances all push towards precision — search to
 * get close, then drag or tap to place it exactly, or stand at the gate and
 * press "use my location".
 *
 * Leaflet is imported inside the effect rather than at module scope. A client
 * component still renders on the server, and Leaflet touches `window` the
 * moment it loads.
 */

const PUNE_CENTRE = { lat: 18.5204, lng: 73.8567 };
const CITY_ZOOM = 12;
const BUILDING_ZOOM = 17;

/** Bias geocoding to the locality — "Nyati Estate" exists in several cities. */
const PUNE_VIEWBOX = "73.70,18.65,74.05,18.40";

type Coords = { lat: number; lng: number };
type SearchHit = { label: string; lat: number; lng: number };

export function LocationPicker({
  initialLat,
  initialLng,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);

  const [pos, setPos] = useState<Coords | null>(
    typeof initialLat === "number" && typeof initialLng === "number"
      ? { lat: initialLat, lng: initialLng }
      : null,
  );
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Drop or move the pin, and remember it. */
  const place = useCallback((next: Coords, zoom?: number) => {
    const L = leaflet.current;
    if (!L || !map.current) return;

    setPos(next);
    setStatus(null);

    if (marker.current) {
      marker.current.setLatLng(next);
    } else {
      marker.current = L.marker(next, { draggable: true, icon: pinIcon(L) })
        .addTo(map.current)
        .on("dragend", (event: Leaflet.DragEndEvent) => {
          const { lat, lng } = (event.target as Leaflet.Marker).getLatLng();
          setPos({ lat, lng });
        });
    }

    map.current.setView(next, zoom ?? Math.max(map.current.getZoom(), BUILDING_ZOOM));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current || map.current) return;

      leaflet.current = L;
      const start = pos ?? PUNE_CENTRE;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView(
        start,
        pos ? BUILDING_ZOOM : CITY_ZOOM,
      );

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);

      map.current = instance;
      instance.on("click", (event: Leaflet.LeafletMouseEvent) => place(event.latlng));
      if (pos) place(pos, BUILDING_ZOOM);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // Mount once. `place` is stable and `pos` is only read for the initial view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Geocoding runs on submit rather than on keystroke — Nominatim is a free
   * service run on donated hardware and asks for at most one request a second.
   */
  async function search(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;

    setBusy(true);
    setStatus(null);
    setHits([]);

    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=json&limit=5` +
        `&countrycodes=in&viewbox=${PUNE_VIEWBOX}&q=${encodeURIComponent(q)}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`search failed (${response.status})`);

      const found = (await response.json()) as { display_name: string; lat: string; lon: string }[];
      if (found.length === 0) {
        setStatus("Nothing found. Try the society name plus the area, or just tap the map.");
        return;
      }

      setHits(
        found.map((f) => ({
          label: f.display_name,
          lat: Number.parseFloat(f.lat),
          lng: Number.parseFloat(f.lon),
        })),
      );
    } catch {
      setStatus("Search is unavailable right now — tap the map to place the pin instead.");
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("This browser can't share a location. Tap the map instead.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (found) => {
        setBusy(false);
        place({ lat: found.coords.latitude, lng: found.coords.longitude }, 18);
      },
      () => {
        setBusy(false);
        setStatus("Couldn't read your location. Tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-2">
      {/* What the server action reads. Empty means "not pinned", which is allowed. */}
      <input type="hidden" name="latitude" value={pos ? pos.lat.toFixed(6) : ""} />
      <input type="hidden" name="longitude" value={pos ? pos.lng.toFixed(6) : ""} />

      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-1 gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search(e);
            }}
            placeholder="Society or landmark — e.g. Nyati Estate, Kharadi"
            aria-label="Search for the society or landmark"
          />
          <Button type="button" variant="outline" size="sm" onClick={search} disabled={busy}>
            <Search /> Find
          </Button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={busy}>
          <Crosshair /> I&apos;m here now
        </Button>
      </div>

      {hits.length > 0 ? (
        <ul className="divide-y rounded-md border text-sm">
          {hits.map((hit) => (
            <li key={`${hit.lat},${hit.lng}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => {
                  place({ lat: hit.lat, lng: hit.lng });
                  setHits([]);
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">{hit.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={container}
        className="h-72 w-full overflow-hidden rounded-lg border"
        role="application"
        aria-label="Map — tap to place the pin"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {pos ? (
            <>
              Pinned at{" "}
              <span className="font-mono tabular-nums">
                {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              </span>{" "}
              — drag the pin to correct it.
            </>
          ) : (
            "Not pinned yet. Search, tap the map, or use your current location."
          )}
        </span>
        {pos ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              marker.current?.remove();
              marker.current = null;
              setPos(null);
            }}
          >
            <X className="size-3" /> Clear
          </button>
        ) : null}
      </div>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}

/** An inline SVG marker, so no image asset has to survive bundling. */
function pinIcon(L: typeof Leaflet) {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    html: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="hsl(222.2 47.4% 11.2%)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="white"/>
      <circle cx="12" cy="10" r="3" fill="hsl(222.2 47.4% 11.2%)"/>
    </svg>`,
  });
}
