/**
 * Which geocoder can find a Pune society by name?
 *
 * The map (0027) stores plain latitude/longitude, so the provider is a swap of
 * two files. What decides the swap is not price or polish but one question: when
 * a broker types the name of the society they are listing, does anything come
 * back? OpenStreetMap demonstrably struggles — "Nyati Estate Kharadi" returns
 * nothing — and that is the primary posting flow.
 *
 * This asks both, with the names a real broker would type, and prints a hit
 * rate. Run it, don't argue about it:
 *
 *   node scripts/compare-geocoders.mjs
 *
 * Needs MAPPLS_CLIENT_ID and MAPPLS_CLIENT_SECRET in .env.local to include
 * Mappls; without them it still reports OpenStreetMap on its own.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";

const PUNE = { lat: 18.5204, lng: 73.8567 };

/** Real societies, the way somebody would actually type them. */
const QUERIES = [
  "Nyati Estate Kharadi",
  "Amanora Park Town Hadapsar",
  "Blue Ridge Hinjewadi",
  "Kolte Patil Life Republic Hinjewadi",
  "Megapolis Hinjewadi",
  "Gera Greensville Kharadi",
  "Rohan Abhilasha Wagholi",
  "Kumar Picasso Hadapsar",
  "Ganga Platino Kharadi",
  "Marvel Diva Wanowrie",
];

function loadEnv(file = ".env.local") {
  const env = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* no .env.local — OSM still works */
  }
  return env;
}

// ---------------------------------------------------------------------------
// OpenStreetMap / Nominatim — what the app ships with today
// ---------------------------------------------------------------------------
async function searchOsm(query) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=3` +
    `&countrycodes=in&viewbox=73.70,18.65,74.05,18.40&q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "kiraya-geocoder-comparison/1.0 (evaluation)" },
  });
  if (!response.ok) return { error: `HTTP ${response.status}` };

  const found = await response.json();
  if (!Array.isArray(found) || found.length === 0) return { hit: false };
  return {
    hit: true,
    label: found[0].display_name,
    lat: Number.parseFloat(found[0].lat),
    lng: Number.parseFloat(found[0].lon),
  };
}

// ---------------------------------------------------------------------------
// Mappls — OAuth token, then Autosuggest biased to Pune
// ---------------------------------------------------------------------------
async function mapplsToken(env) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.MAPPLS_CLIENT_ID,
    client_secret: env.MAPPLS_CLIENT_SECRET,
  });

  const response = await fetch("https://outpost.mappls.com/api/security/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description ?? payload?.error ?? `HTTP ${response.status}`);
  }
  return `${payload.token_type ?? "bearer"} ${payload.access_token}`;
}

async function searchMappls(query, auth) {
  const url =
    `https://atlas.mappls.com/api/places/search/json?query=${encodeURIComponent(query)}` +
    `&location=${PUNE.lat},${PUNE.lng}`;

  const response = await fetch(url, { headers: { Authorization: auth } });
  if (!response.ok) return { error: `HTTP ${response.status}` };

  const payload = await response.json().catch(() => null);
  const list = payload?.suggestedLocations ?? payload?.results ?? [];
  if (!Array.isArray(list) || list.length === 0) {
    return { hit: false, raw: payload ? Object.keys(payload).join(",") : "no body" };
  }

  const top = list[0];
  return {
    hit: true,
    label: [top.placeName, top.placeAddress].filter(Boolean).join(" — "),
    lat: top.latitude ?? top.lat ?? null,
    lng: top.longitude ?? top.lng ?? null,
    eloc: top.eLoc ?? null,
  };
}

// ---------------------------------------------------------------------------
async function main() {
  const env = { ...loadEnv(), ...process.env };
  const hasMappls = Boolean(env.MAPPLS_CLIENT_ID && env.MAPPLS_CLIENT_SECRET);

  let auth = null;
  if (hasMappls) {
    try {
      auth = await mapplsToken(env);
      console.log("Mappls: token acquired\n");
    } catch (cause) {
      console.log(`Mappls: could not authenticate — ${cause.message}\n`);
    }
  } else {
    console.log("Mappls: skipped, no MAPPLS_CLIENT_ID / MAPPLS_CLIENT_SECRET in .env.local\n");
  }

  const score = { osm: 0, mappls: 0 };

  for (const query of QUERIES) {
    console.log(`\x1b[1m${query}\x1b[0m`);

    const osm = await searchOsm(query);
    if (osm.error) console.log(`  osm     \x1b[31m!\x1b[0m ${osm.error}`);
    else if (!osm.hit) console.log("  osm     \x1b[31m✗\x1b[0m nothing");
    else {
      score.osm += 1;
      console.log(`  osm     \x1b[32m✓\x1b[0m ${truncate(osm.label)}`);
    }

    if (auth) {
      const mappls = await searchMappls(query, auth);
      if (mappls.error) console.log(`  mappls  \x1b[31m!\x1b[0m ${mappls.error}`);
      else if (!mappls.hit) console.log(`  mappls  \x1b[31m✗\x1b[0m nothing (${mappls.raw})`);
      else {
        score.mappls += 1;
        console.log(
          `  mappls  \x1b[32m✓\x1b[0m ${truncate(mappls.label)}` +
            (mappls.eloc ? `  [eLoc ${mappls.eloc}]` : ""),
        );
      }
    }

    // Nominatim's usage policy asks for no more than one request a second.
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  const total = QUERIES.length;
  console.log(`\n\x1b[1mFound by name\x1b[0m`);
  console.log(`  OpenStreetMap  ${score.osm}/${total}`);
  if (auth) console.log(`  Mappls         ${score.mappls}/${total}`);
}

const truncate = (s) => (s.length <= 90 ? s : `${s.slice(0, 87)}…`);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("comparison crashed:", error);
    process.exit(1);
  });
}
