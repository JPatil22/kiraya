"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BUILDING_ZOOM,
  CITY_ZOOM,
  PUNE_BOUNDS,
  PUNE_CENTRE,
  loadGoogleMaps,
} from "@/lib/maps";

/**
 * Pin the flat, on Google (0027).
 *
 * Same three ways in as the OpenStreetMap version, because they fail in
 * different situations: type the society name, tap the map, or press "I'm here
 * now" while standing at the gate. What changes is the first one actually
 * working — Places knows Indian societies by name, which is the reason this
 * provider exists in the codebase at all.
 *
 * Autocomplete is bound directly to the input rather than rendering our own
 * results list: Google's terms require their attribution on results, and their
 * widget carries it.
 */

type Coords = { lat: number; lng: number };

export function GoogleLocationPicker({
  initialLat,
  initialLng,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);

  const [pos, setPos] = useState<Coords | null>(
    typeof initialLat === "number" && typeof initialLng === "number"
      ? { lat: initialLat, lng: initialLng }
      : null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const place = useCallback((next: Coords, zoom?: number) => {
    if (typeof google === "undefined" || !map.current) return;

    setPos(next);
    setStatus(null);

    if (marker.current) {
      marker.current.setPosition(next);
    } else {
      marker.current = new google.maps.Marker({
        position: next,
        map: map.current,
        draggable: true,
      });
      marker.current.addListener("dragend", (event: google.maps.MapMouseEvent) => {
        if (event.latLng) setPos({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
    }

    map.current.setCenter(next);
    map.current.setZoom(Math.max(map.current.getZoom() ?? 0, zoom ?? BUILDING_ZOOM));
  }, []);

  // Two effects on purpose. Loading is async, and React runs effects twice in
  // development — so a single effect that builds the map inside `.then()` can
  // have its cleanup fire during the await, cancel itself, and leave an empty
  // container with no error to show for it. Splitting means the build runs
  // synchronously once `ready` flips, with no gap for a cleanup to land in.
  useEffect(() => {
    let live = true;
    loadGoogleMaps()
      .then(() => {
        if (live) setReady(true);
      })
      .catch((error: Error) => {
        if (live) setStatus(error.message);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (ready && container.current && !map.current) {
      {
        map.current = new google.maps.Map(container.current, {
          center: pos ?? PUNE_CENTRE,
          zoom: pos ? BUILDING_ZOOM : CITY_ZOOM,
          mapTypeControl: true,
          // Rooftops are how somebody recognises their own building; road lines
          // are not. This is the single biggest aid to placing an accurate pin.
          mapTypeId: "hybrid",
          streetViewControl: false,
          fullscreenControl: false,
        });

        map.current.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) place({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });

        if (pos) place(pos, BUILDING_ZOOM);

        if (searchInput.current) {
          const autocomplete = new google.maps.places.Autocomplete(searchInput.current, {
            fields: ["geometry", "name", "formatted_address"],
            componentRestrictions: { country: "in" },
            bounds: new google.maps.LatLngBounds(
              { lat: PUNE_BOUNDS.south, lng: PUNE_BOUNDS.west },
              { lat: PUNE_BOUNDS.north, lng: PUNE_BOUNDS.east },
            ),
          });

          autocomplete.addListener("place_changed", () => {
            const found = autocomplete.getPlace();
            if (!found?.geometry?.location) {
              setStatus("Pick one of the suggestions, or tap the map.");
              return;
            }
            place({
              lat: found.geometry.location.lat(),
              lng: found.geometry.location.lng(),
            });
          });
        }
      }
    }
    // `pos` and `place` are read only to draw the opening view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("This browser can't share a location. Tap the map instead.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (found) => {
        setBusy(false);
        place({ lat: found.coords.latitude, lng: found.coords.longitude }, 19);
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
      <input type="hidden" name="latitude" value={pos ? pos.lat.toFixed(6) : ""} />
      <input type="hidden" name="longitude" value={pos ? pos.lng.toFixed(6) : ""} />

      <div className="flex flex-wrap gap-2">
        <Input
          ref={searchInput}
          className="min-w-0 flex-1"
          placeholder="Society or landmark — e.g. Nyati Estate, Kharadi"
          aria-label="Search for the society or landmark"
          // Enter selects a suggestion; it must not submit the listing form.
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={busy}>
          <Crosshair /> I&apos;m here now
        </Button>
      </div>

      <div
        ref={container}
        className="h-72 w-full overflow-hidden rounded-lg border bg-muted"
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
              marker.current?.setMap(null);
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
