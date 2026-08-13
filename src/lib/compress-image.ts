export interface ImageCompressResult {
  file: File;
  originalSize: number;
  finalSize: number;
  hitTarget: boolean;
}

const OUTPUT_MIME = "image/jpeg"; // see note below on why every format converts here

/**
 * Compresses an image toward an exact target size using a real binary
 * search over JPEG quality (and, if quality alone can't reach the target,
 * progressively smaller dimensions) — re-encoding and measuring the actual
 * output at each step rather than stopping at the first result that
 * happens to land under the target.
 *
 * Why everything becomes a JPEG: canvas's toBlob() only supports quality
 * adjustment for image/jpeg and image/webp — PNG is always lossless, so
 * "compressing" a PNG at the same dimensions barely changes its size.
 * JPEG gives the most predictable, tunable target-size behavior, so that's
 * what every input (PNG, GIF, BMP, TIFF, WEBP) converts to here. This means
 * transparency is lost (flattened onto white) — that trade-off is the
 * price of hitting an exact size, and it's called out in the tool's UI.
 */
export async function compressImageToTarget(
  file: File,
  targetBytes: number,
  onProgress?: (message: string) => void
): Promise<ImageCompressResult> {
  const bitmap = await createImageBitmap(file);
  const originalSize = file.size;

  // Try at full size first, then progressively smaller dimensions if even
  // minimum-quality JPEG at full size can't reach the target.
  const scales = [1, 0.85, 0.7, 0.55, 0.4, 0.25];

  let best: { blob: Blob; scale: number; quality: number } | null = null;

  for (const scale of scales) {
    onProgress?.(`Trying at ${Math.round(scale * 100)}% size…`);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    // Flatten onto white first — JPEG has no alpha channel.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const result = await binarySearchQuality(canvas, targetBytes);
    if (!best || Math.abs(result.blob.size - targetBytes) < Math.abs(best.blob.size - targetBytes)) {
      best = { blob: result.blob, scale, quality: result.quality };
    }
    // Once we've found something at or under the target, that's good enough —
    // no need to shrink dimensions further and lose more detail than necessary.
    if (result.blob.size <= targetBytes) break;
  }

  if (!best) throw new Error("Could not encode this image.");

  const outName = file.name.replace(/\.[^.]+$/, "") + "-compressed.jpg";
  const outFile = new File([best.blob], outName, { type: OUTPUT_MIME });

  return {
    file: outFile,
    originalSize,
    finalSize: outFile.size,
    hitTarget: outFile.size <= targetBytes,
  };
}

async function binarySearchQuality(
  canvas: HTMLCanvasElement,
  targetBytes: number
): Promise<{ blob: Blob; quality: number }> {
  let lowQ = 0.02;
  let highQ = 0.97;
  let best: { blob: Blob; quality: number } | null = null;

  for (let i = 0; i < 8; i++) {
    const quality = (lowQ + highQ) / 2;
    const blob = await encodeAt(canvas, quality);
    if (!blob) continue;

    if (!best || Math.abs(blob.size - targetBytes) < Math.abs(best.blob.size - targetBytes)) {
      best = { blob, quality };
    }

    if (blob.size > targetBytes) {
      highQ = quality; // too big — reduce quality further
    } else {
      lowQ = quality; // under target — nudge quality back up to use the size budget
    }
  }

  if (!best) throw new Error("Encoding failed.");
  return best;
}

function encodeAt(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), OUTPUT_MIME, quality));
}
