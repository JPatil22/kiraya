/**
 * Shrink a photo in the browser before it is uploaded (0031-era, no migration).
 *
 * A phone camera produces 3–8 MB at 4000px wide. That file was being stored
 * as-is and then served, at full size, to a tenant scrolling a feed on mobile
 * data — the largest avoidable cost this product imposes on the person it
 * claims to serve, and it imposes it on the poster's upload too.
 *
 * Done client-side on purpose. Supabase image transformation is a paid tier,
 * `next/image` cannot help with a runtime Storage host, and a server-side
 * resize would mean shipping the full file over the wire first — which is the
 * expensive half. The browser already has the bytes.
 *
 * Nothing here is trusted: the server still enforces MIME type and the 5 MB
 * ceiling, because a resize that happens in the client is a courtesy, not a
 * control. It also means a listing whose photos fail to shrink still uploads,
 * rather than a canvas quirk on one phone blocking somebody's listing.
 */

/** Long edge, in pixels. Comfortably above what any card or gallery renders. */
const MAX_EDGE = 1600;

/** JPEG quality. 0.82 is where artefacts stop being visible on photographs. */
const QUALITY = 0.82;

/** Below this, resizing costs more than it saves. */
const SKIP_UNDER_BYTES = 400_000;

/**
 * The feed thumbnail (0033). ~400px is twice what a card renders on a phone, so
 * it stays crisp on a 2x screen while costing a tenth of the full image's bytes
 * — and the feed is where a tenant pulls twenty at once. 0.7 is acceptable at
 * this size: nobody decides on a flat from the card, they decide from the
 * detail page, which still gets the full-quality image.
 */
const THUMB_EDGE = 400;
const THUMB_QUALITY = 0.7;

export async function downscaleImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (file.size <= SKIP_UNDER_BYTES) return file;
  // PNGs are often screenshots or floor plans, where re-encoding to JPEG loses
  // text clarity for little gain. Photographs are what this is for.
  if (file.type !== "image/jpeg" && file.type !== "image/webp") return file;

  const resized = await resizeToJpeg(file, MAX_EDGE, QUALITY);
  // If the round trip didn't shrink it, keep the original bytes and name.
  if (!resized || resized.size >= file.size) return file;
  return new File([resized], swapExtension(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

/**
 * A ~400px card-sized copy, or null if the browser couldn't make one (0033).
 *
 * Unlike the full downscale this runs for every image type, PNG included: a
 * screenshot loses some text clarity shrunk to a card, but a card is a glance,
 * and the detail page still shows the original. Null is a normal outcome, not
 * an error — the upload proceeds without a thumbnail and readers fall back to
 * the full image.
 */
export async function thumbnailImage(file: File): Promise<File | null> {
  if (typeof document === "undefined") return null;
  const blob = await resizeToJpeg(file, THUMB_EDGE, THUMB_QUALITY);
  if (!blob) return null;
  return new File([blob], thumbName(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

/**
 * Draw the image onto a canvas at most `maxEdge` on its long side and read it
 * back as a JPEG blob. Returns null on any failure — a canvas quirk on one
 * device must not stop somebody listing a flat.
 */
async function resizeToJpeg(
  file: File,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
  } catch {
    return null;
  }
}

function swapExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}

function thumbName(name: string): string {
  return name.replace(/\.[^.]+$/, "") + "_thumb.jpg";
}
