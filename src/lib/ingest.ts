import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseListingText, parseListingTextAsync } from "@/lib/listing-parser";
import { resolveBrokerage } from "@/lib/brokerage";
import { PHOTO_BUCKET, MAX_PHOTOS, MAX_PHOTO_BYTES, ACCEPTED_MIME, photoObjectKey } from "@/lib/photos";

/**
 * Turn a scraped source post (Facebook, via the Chrome ingestor) into a listing.
 *
 * The whole pipeline: parse the post text with the zero-credential regex parser,
 * decide whether an owner or a broker is behind it, insert the listing as
 * `pending_review` (an admin eyeballs the auto-parsed numbers before it reaches
 * a tenant — the parse is a guess, not a fact), keep the real source number
 * privately in `listing_sources`, and stage the photos in `ingest_photos` for a
 * human to tag by room. Nothing here claims verification: a scraped listing is
 * not one Kiraya has stood behind.
 *
 * Runs with a service-role client (the endpoint is authorised by INGEST_API_KEY,
 * not by a session), so RLS and the properties guard pass through — the same
 * footing as scripts/import-listing.mjs. The brokerage guard still runs.
 */

/** Seeded open-mode posters (scripts/seed-dev.mjs). */
const POSTER_PHONE = { broker: "+919000000003", owner: "+919000000002" } as const;

export type IngestPayload = {
  source: string;
  text: string;
  images: string[];
};

export type IngestResult = {
  propertyId: string;
  role: "owner" | "broker";
  photosStaged: number;
  /** Non-photo payloads (FB stickers/keyframes, thumbnails) — expected, not errors. */
  photosSkipped: number;
  photosFailed: number;
  parsed: ReturnType<typeof parseListingText>;
};

/**
 * Owner or broker? Facebook rental groups are broker-dominated, so the default
 * is broker; only an explicit owner signal ("direct owner", "by owner", "no
 * broker") flips it. An admin can still correct the role in review.
 */
function inferRole(text: string): "owner" | "broker" {
  if (/\b(?:direct(?:ly)?\s*owner|by\s*owner|owner\s*(?:direct|listing|post|only)|no\s*broker(?!age))\b/i.test(text)) {
    return "owner";
  }
  return "broker";
}

/**
 * Hide Indian mobile numbers before the post text becomes a public description.
 * The real number is kept privately in listing_sources; it must not ride into
 * the tenant-facing page, where contact is supposed to be gated behind unlock.
 * Over-redacts rather than under — a stray blanked number beats a leaked one.
 */
export function redactPhones(text: string): string {
  return text
    .replace(/(?:\+?91[\s-]?|0)?[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, "[number hidden]")
    .replace(/\b[6-9]\d{9}\b/g, "[number hidden]");
}

/** Clamp the parsed title to the properties.title CHECK (4–120 chars). */
function safeTitle(title: string, bhk: string): string {
  const t = title.trim();
  if (t.length >= 4) return t.slice(0, 120);
  return `${bhk.toUpperCase()} rental — needs review`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolvePoster(
  db: SupabaseClient<Database>,
  role: "owner" | "broker",
): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("phone", POSTER_PHONE[role])
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Outcome of trying to stage one scraped image.
 *   - key present  → a real photo, uploaded and ready to tag.
 *   - skipped:true → not a photo we want (a Facebook animated sticker /
 *     keyframe, a tiny thumbnail, an oversized file). Expected junk, not an error.
 *   - skipped:false → a genuine failure (HTTP error, network, storage).
 */
type StageOutcome = { key: string } | { key: null; skipped: boolean };

/** Content types the listing-photos bucket accepts. */
const PHOTO_MIME = new Set(ACCEPTED_MIME);

/**
 * Download one image and put it in the listing-photos bucket. Facebook posts
 * carry more than photos — animated stickers arrive as `image/x.fb.keyframes`,
 * reactions as tiny thumbnails — so anything that isn't a real JPEG/PNG/WebP is
 * skipped (not counted as a failure), keeping the staged set to actual photos.
 */
/** Upgrade a Facebook CDN image URL to fetch the full uncropped high-res original instead of low-res feed thumbnails. */
function upgradeFacebookImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("fbcdn.net")) {
      u.searchParams.delete("stp");
    }
    return u.toString();
  } catch {
    return url;
  }
}

async function stageOnePhoto(
  db: SupabaseClient<Database>,
  propertyId: string,
  rawUrl: string,
): Promise<StageOutcome> {
  if (!rawUrl.startsWith("http")) return { key: null, skipped: true };
  const url = upgradeFacebookImageUrl(rawUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const short = url.slice(0, 90);
  try {
    // Facebook's CDN 403s bare server-side fetches; a browser-like User-Agent
    // and a facebook.com Referer make it serve the image the way it would to a tab.
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        // Only ask for formats the bucket can actually store. Requesting AVIF
        // makes format-negotiating hosts (e.g. Unsplash `auto=format`) serve
        // AVIF, which we then have to skip — so leave it out entirely.
        Accept: "image/webp,image/png,image/jpeg,*/*;q=0.8",
        Referer: "https://www.facebook.com/",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      console.warn(`  [photo] HTTP ${response.status}: ${short}`);
      return { key: null, skipped: false };
    }

    // Reject non-photo payloads (stickers/keyframes/gifs) before touching Storage.
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!PHOTO_MIME.has(contentType)) {
      console.log(`  [photo] skip non-photo (${contentType || "unknown"}): ${url}`);
      return { key: null, skipped: true };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) {
      console.log(`  [photo] skip tiny (${buffer.length}B): ${short}`);
      return { key: null, skipped: true };
    }
    if (buffer.length > MAX_PHOTO_BYTES) {
      console.log(`  [photo] skip oversize (${buffer.length}B): ${short}`);
      return { key: null, skipped: true };
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const key = photoObjectKey(propertyId, `scraped.${ext}`);

    const { error } = await db.storage
      .from(PHOTO_BUCKET)
      .upload(key, buffer, { contentType, upsert: false });
    if (error) {
      console.warn(`  [photo] storage upload failed: ${error.message}`);
      return { key: null, skipped: false };
    }
    return { key };
  } catch (err) {
    console.warn(`  [photo] fetch error (${(err as Error).name}): ${short}`);
    return { key: null, skipped: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function ingestListing(
  db: SupabaseClient<Database>,
  payload: IngestPayload,
): Promise<IngestResult> {
  const localitySlug = process.env.NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG ?? "pune";
  const { data: locality } = await db
    .from("localities")
    .select("id")
    .eq("slug", localitySlug)
    .maybeSingle();
  if (!locality) throw new Error(`No locality with slug '${localitySlug}'.`);

  const parsed = await parseListingTextAsync(payload.text);
  const role: "owner" | "broker" = inferRole(payload.text);

  const postedBy = await resolvePoster(db, role);
  if (!postedBy) {
    throw new Error(`No seeded ${role} identity — run npm run db:seed.`);
  }

  // Brokerage: read from the post when the broker stated it; an owner listing
  // carries none. When a broker post is silent on the fee, default to standard
  // 1 month's rent (the market standard in Pune) so the listing carries
  // an accurate fee breakdown rather than falsely claiming 0 brokerage.
  const isBroker = role === "broker";
  const feeAmount = isBroker ? (parsed.brokerage ?? parsed.rent ?? 0) : 0;
  const feeSaidNone = isBroker ? parsed.brokerage === 0 : true;
  const fee = resolveBrokerage(role, feeAmount, feeSaidNone);
  if (!fee.ok) throw new Error(fee.message);

  const { data: created, error } = await db
    .from("properties")
    .insert({
      posted_by: postedBy,
      locality_id: locality.id,
      area_id: null, // parser doesn't resolve an area; admin picks one in review
      latitude: null,
      longitude: null,
      title: safeTitle(parsed.title, parsed.bhk),
      // The listing's own text — focused to one post and stripped of Facebook
      // chrome by the parser, then phone-redacted so no number rides into the
      // public page. Capped to the description CHECK (<= 2000).
      description: redactPhones(parsed.cleanText || payload.text).slice(0, 2000) || null,
      address_line: parsed.address_line,
      bhk: parsed.bhk,
      furnishing: parsed.furnishing,
      occupancy_pref: parsed.occupancy_pref,
      rent: parsed.rent ?? 0, // rent is NOT NULL; 0 is a placeholder to fix in review
      deposit: parsed.deposit ?? (parsed.rent ? parsed.rent * 2 : 0),
      maintenance_monthly: 0,
      brokerage: fee.amount,
      brokerage_disclosed: fee.disclosed,
      one_time_charges: 0,
      available_from: today(),
      availability: "available",
      status: "pending_review", // never straight to the feed — the parse is a guess
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`Insert failed: ${error?.message ?? "no row returned"}`);
  }
  const propertyId = created.id;

  // Private contact for the tenant on unlock: the real name and number from the
  // post. The note carries only a review flag — no source URL, so nothing names
  // where the listing came from.
  const note =
    isBroker && parsed.brokerage == null
      ? "Brokerage not stated in the source — set before approving"
      : null;
  const hasSource = parsed.sourceName || parsed.phone || note;
  if (hasSource) {
    await db.from("listing_sources").insert({
      property_id: propertyId,
      source_name: parsed.sourceName,
      source_phone: parsed.phone,
      note,
      created_by: postedBy,
    });
  }

  // Stage photos for room-tagging. Walk every candidate (not just the first N),
  // skipping stickers/thumbnails, and stop once MAX_PHOTOS *real* photos land —
  // so a pile of animated stickers can't crowd out the actual room shots. Cap
  // the total attempts so a runaway image list can't hammer the CDN.
  let photosStaged = 0;
  let photosSkipped = 0;
  let photosFailed = 0;
  for (const url of payload.images.slice(0, 40)) {
    if (photosStaged >= MAX_PHOTOS) break;
    const outcome = await stageOnePhoto(db, propertyId, url);
    if (outcome.key === null) {
      if (outcome.skipped) photosSkipped += 1;
      else photosFailed += 1;
      continue;
    }
    const { error: stageErr } = await db.from("ingest_photos").insert({
      property_id: propertyId,
      storage_path: outcome.key,
      thumbnail_path: null,
      source_url: payload.source.slice(0, 500),
      created_by: postedBy,
    });
    if (stageErr) {
      photosFailed += 1;
      // Don't leave an orphaned object behind if the staging row failed.
      await db.storage.from(PHOTO_BUCKET).remove([outcome.key]);
    } else {
      photosStaged += 1;
    }
  }

  return { propertyId, role, photosStaged, photosSkipped, photosFailed, parsed };
}
