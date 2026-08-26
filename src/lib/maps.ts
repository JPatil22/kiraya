/**
 * Which map draws the pin.
 *
 * The database stores plain latitude and longitude (0027), so the provider is a
 * rendering decision rather than a data one, and it lives behind this flag.
 *
 * OpenStreetMap is the default because it needs no key, no billing account and
 * no console — the app works for anyone who clones it. Google is switched on by
 * supplying a key, and the reason to bother is one measured number: of ten real
 * Pune society names, OSM's geocoder found three, and one of those was an EV
 * charging station inside the society rather than the society itself. Brokers
 * search by society name. See scripts/compare-geocoders.mjs.
 *
 * Not a hybrid, deliberately. Google's terms forbid showing Google Maps content
 * — including Places results — on a non-Google map, so "Leaflet tiles with
 * Google search" is not a licence-compliant option. It is one provider or the
 * other, top to bottom.
 */

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function usingGoogleMaps(): boolean {
  return GOOGLE_MAPS_KEY.length > 0;
}

/** Where the map opens when a listing has no pin yet. */
export const PUNE_CENTRE = { lat: 18.5204, lng: 73.8567 };
export const CITY_ZOOM = 12;
export const AREA_ZOOM = 14;
export const BUILDING_ZOOM = 17;

/**
 * Half-width of the box used to bias place search around a chosen area —
 * roughly 5km, which covers a Pune neighbourhood and excludes the next one.
 */
export const SEARCH_BIAS_DEGREES = 0.045;

/**
 * Bounds for biasing search towards the launch locality. "Nyati Estate" and
 * "Blue Ridge" both exist in more than one Indian city.
 */
export const PUNE_BOUNDS = {
  south: 18.40,
  west: 73.70,
  north: 18.65,
  east: 74.05,
};

type GoogleNamespace = typeof globalThis & { google?: unknown };

let loader: Promise<void> | null = null;

/**
 * Load the Maps JavaScript API once, however many components ask for it.
 *
 * Google's own loader is a global side effect either way; keeping the promise
 * here means two maps on one page share a single script tag rather than racing
 * to append their own.
 */
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (loader) return loader;

  loader = (async () => {
    if (!GOOGLE_MAPS_KEY) throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set");

    // Note there is no `if (window.google) return` shortcut. Under
    // `loading=async` the script defines `google.maps.importLibrary` and
    // nothing else — `google.maps.Map` is still undefined at that point — so
    // testing for the namespace reports ready far too early, and the caller
    // gets "google.maps.Map is not a constructor". This promise resolving is
    // the only honest signal, which is also why every caller shares it.
    ensureScript();
    await waitForBootstrap();

    await Promise.all([
      google.maps.importLibrary("maps"),
      google.maps.importLibrary("places"),
    ]);
  })();

  return loader;
}

/**
 * Google calls this global when it rejects the key, and then paints its own
 * grey "Oops! Something went wrong" panel into every map container. The panel
 * says to check the console; the console says the same thing in more words.
 * Neither mentions the actual cause, which is almost always that the key's HTTP
 * referrer restrictions do not include the host it is being loaded from — the
 * exact failure a first deployment hits, because the key was set up against
 * localhost.
 */
function installAuthFailureHandler() {
  const w = window as GoogleNamespace & { gm_authFailure?: () => void };
  if (w.gm_authFailure) return;

  w.gm_authFailure = () => {
    console.error(
      `[maps] Google rejected the API key for ${window.location.origin}. ` +
        "Add this origin to the key's HTTP referrer restrictions in Google Cloud " +
        "(APIs & Services → Credentials), or remove NEXT_PUBLIC_GOOGLE_MAPS_API_KEY " +
        "to fall back to OpenStreetMap. See docs/DEPLOY.md §3.",
    );
  };
}

function ensureScript() {
  installAuthFailureHandler();
  if (document.getElementById("google-maps-sdk")) return;

  const script = document.createElement("script");
  script.id = "google-maps-sdk";
  script.async = true;
  script.src =
    `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}` +
    `&loading=async&region=IN&language=en`;
  document.head.appendChild(script);
}

/**
 * Poll for the bootstrap rather than listening for `load`.
 *
 * An event listener only fires if it was attached before the event, and in
 * development this module gets re-evaluated by Fast Refresh — so a fresh loader
 * can find a script tag that finished loading seconds ago, attach a listener to
 * it, and wait forever. Polling a condition is indifferent to when it became
 * true, which is the property that matters here.
 */
function waitForBootstrap(timeoutMs = 15_000): Promise<void> {
  const ready = () => typeof (window as GoogleNamespace).google !== "undefined"
    && typeof google?.maps?.importLibrary === "function";

  if (ready()) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      if (ready()) {
        window.clearInterval(tick);
        resolve();
      } else if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(tick);
        reject(new Error("Google Maps did not load — check the key and its referrer restrictions"));
      }
    }, 50);
  });
}
