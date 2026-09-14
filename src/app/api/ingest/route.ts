import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestListing } from "@/lib/ingest";

/**
 * /api/ingest — the landing point for the Chrome ingestor (chrome-extension/).
 *
 * It receives a scraped Facebook post ({ source, text, images }), authorised by
 * a shared INGEST_API_KEY, and turns it into a `pending_review` listing with its
 * photos staged for room-tagging. Service-role throughout: the API key is the
 * authorisation, so this works whether or not open mode is on — the same footing
 * as scripts/import-listing.mjs. See src/lib/ingest.ts for the actual work.
 *
 * CORS is open because the request originates from a content script running on
 * facebook.com, not from our own origin.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.INGEST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Ingestion is not configured (INGEST_API_KEY unset)." },
      { status: 503, headers: corsHeaders },
    );
  }

  const token = req.headers.get("authorization")?.split(" ")[1];
  if (token !== apiKey) {
    return NextResponse.json(
      { error: "Unauthorized. Invalid or missing API key." },
      { status: 401, headers: corsHeaders },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON." },
      { status: 400, headers: corsHeaders },
    );
  }

  const { source, text, images } = (body ?? {}) as {
    source?: unknown;
    text?: unknown;
    images?: unknown;
  };

  if (typeof text !== "string" || text.trim().length < 10) {
    return NextResponse.json(
      { error: "No usable post text — click text on the post before extracting." },
      { status: 400, headers: corsHeaders },
    );
  }

  const payload = {
    source: typeof source === "string" ? source : "unknown",
    text,
    images: Array.isArray(images) ? images.filter((u): u is string => typeof u === "string") : [],
  };

  try {
    const db = createServiceClient();
    const result = await ingestListing(db, payload);

    console.log(
      `[ingest] ${result.role} listing ${result.propertyId} — ` +
        `${result.photosStaged} photos staged, ${result.photosSkipped} skipped (non-photo), ${result.photosFailed} failed. ` +
        `rent=${result.parsed.rent ?? "?"} bhk=${result.parsed.bhk} ` +
        `brokerage=${result.parsed.brokerage ?? "unstated"}`,
    );

    return NextResponse.json(
      {
        success: true,
        propertyId: result.propertyId,
        role: result.role,
        photosStaged: result.photosStaged,
        photosSkipped: result.photosSkipped,
        photosFailed: result.photosFailed,
        review: `/admin/listings/${result.propertyId}`,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("[ingest] failed:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal Server Error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
