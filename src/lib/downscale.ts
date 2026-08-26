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

export async function downscaleImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (file.size <= SKIP_UNDER_BYTES) return file;
  // PNGs are often screenshots or floor plans, where re-encoding to JPEG loses
  // text clarity for little gain. Photographs are what this is for.
  if (file.type !== "image/jpeg" && file.type !== "image/webp") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    if (scale === 1) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );

    // If the round trip somehow produced something larger, keep the original.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], swapExtension(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // A canvas quirk on one device must not stop somebody listing a flat.
    return file;
  }
}

function swapExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}
