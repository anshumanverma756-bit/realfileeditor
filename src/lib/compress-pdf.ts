import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from "pdf-lib";

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  finalSize: number;
  attempts: number;
  imagesRecompressed: number;
  hitTarget: boolean;
  /** True if pages were rasterized to hit the target — text is no longer selectable/searchable. */
  rasterized: boolean;
}

export type ProgressFn = (message: string, fraction: number) => void;

/**
 * Two-tier compressor:
 *
 * Tier 1 — re-encode embedded JPEG images (Filter = DCTDecode) at lower
 * quality and re-save with object streams. Preserves selectable text and
 * vector content untouched. Works well when a PDF's size is dominated by
 * photos, and does nothing for PDFs that have no embedded JPEGs.
 *
 * Tier 2 — if tier 1 can't reach the target (including the common case of
 * a text/table PDF with no images at all, where tier 1 is a no-op), render
 * every page to an image at a resolution/quality chosen to hit the target
 * and rebuild the PDF from those page images. This can compress *any* PDF
 * to *any* reasonable target, but the trade-off is real: the result is no
 * longer selectable or searchable text, just page images. The caller is
 * told which tier produced the result (`rasterized`) so the UI can say so.
 */
export async function compressPdfToTarget(
  originalBytes: Uint8Array,
  targetBytes: number,
  onProgress?: ProgressFn
): Promise<CompressResult> {
  const originalSize = originalBytes.byteLength;
  const qualitySteps = [0.85, 0.7, 0.55, 0.4, 0.28, 0.18];

  let best: { bytes: Uint8Array; imagesRecompressed: number } | null = null;
  let attempts = 0;

  for (const quality of qualitySteps) {
    attempts++;
    onProgress?.(`Re-encoding images at ${Math.round(quality * 100)}% quality…`, attempts / qualitySteps.length);

    try {
      const { bytes, imagesRecompressed } = await recompressOnce(originalBytes, quality);
      if (!best || bytes.byteLength < best.bytes.byteLength) {
        best = { bytes, imagesRecompressed };
      }
      if (bytes.byteLength <= targetBytes) {
        return {
          bytes,
          originalSize,
          finalSize: bytes.byteLength,
          attempts,
          imagesRecompressed,
          hitTarget: true,
          rasterized: false,
        };
      }
      // No embedded JPEGs to recompress — every quality step will produce
      // an identical result, so don't waste time looping through the rest.
      if (imagesRecompressed === 0) break;
    } catch {
      continue;
    }
  }

  // Tier 1 didn't reach the target. Try tier 2: rasterize pages so the
  // target is reachable regardless of what the PDF is made of.
  onProgress?.("Tier 1 wasn't enough — rendering pages as images to reach your target…", 0.5);
  let rasterResult: { bytes: Uint8Array } | null = null;
  try {
    rasterResult = await rasterizeToTarget(originalBytes, targetBytes, onProgress);
  } catch {
    rasterResult = null;
  }

  const candidates: { bytes: Uint8Array; imagesRecompressed: number; rasterized: boolean }[] = [];
  if (best) candidates.push({ bytes: best.bytes, imagesRecompressed: best.imagesRecompressed, rasterized: false });
  if (rasterResult) candidates.push({ bytes: rasterResult.bytes, imagesRecompressed: 0, rasterized: true });

  if (candidates.length === 0) {
    // Total fallback: just re-save with object streams (metadata/structure savings only).
    const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const bytes = await doc.save({ useObjectStreams: true });
    return {
      bytes,
      originalSize,
      finalSize: bytes.byteLength,
      attempts,
      imagesRecompressed: 0,
      hitTarget: bytes.byteLength <= targetBytes,
      rasterized: false,
    };
  }

  // Prefer whichever candidate actually hits the target; among those that
  // do, prefer the one that keeps text selectable (tier 1). Otherwise, take
  // whichever got closest to the target overall.
  const hitters = candidates.filter((c) => c.bytes.byteLength <= targetBytes);
  const pick =
    hitters.find((c) => !c.rasterized) ??
    hitters[0] ??
    candidates.reduce((a, b) => (Math.abs(a.bytes.byteLength - targetBytes) <= Math.abs(b.bytes.byteLength - targetBytes) ? a : b));

  return {
    bytes: pick.bytes,
    originalSize,
    finalSize: pick.bytes.byteLength,
    attempts,
    imagesRecompressed: pick.imagesRecompressed,
    hitTarget: pick.bytes.byteLength <= targetBytes,
    rasterized: pick.rasterized,
  };
}

async function recompressOnce(
  originalBytes: Uint8Array,
  quality: number
): Promise<{ bytes: Uint8Array; imagesRecompressed: number }> {
  const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  let imagesRecompressed = 0;

  const entries = doc.context.enumerateIndirectObjects();
  for (const [ref, obj] of entries) {
    if (!(obj instanceof PDFRawStream)) continue;
    const subtype = obj.dict.get(PDFName.of("Subtype"));
    if (!subtype || subtype.toString() !== "/Image") continue;

    const filter = obj.dict.get(PDFName.of("Filter"));
    const isJpeg = filter?.toString() === "/DCTDecode";
    if (!isJpeg) continue;

    try {
      const recompressed = await recompressJpeg(obj.contents, quality);
      if (recompressed && recompressed.byteLength < obj.contents.byteLength) {
        const newStream = PDFRawStream.of(obj.dict, recompressed);
        newStream.dict.set(PDFName.of("Length"), PDFNumber.of(recompressed.byteLength));
        doc.context.assign(ref, newStream);
        imagesRecompressed++;
      }
    } catch {
      continue;
    }
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { bytes, imagesRecompressed };
}

async function recompressJpeg(jpegBytes: Uint8Array, quality: number): Promise<Uint8Array | null> {
  const blob = new Blob([jpegBytes as BlobPart], { type: "image/jpeg" });
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);

  const outBlob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  if (!outBlob) return null;

  const buf = await outBlob.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Renders every page to a JPEG at a resolution/quality combo, then rebuilds
 * the PDF from those page images, trying progressively smaller combos until
 * the target is hit (or combos run out, in which case the closest attempt
 * is returned). Page physical dimensions are preserved — only pixel density
 * and JPEG quality change — so the printed/viewed size doesn't shift.
 */
async function rasterizeToTarget(
  originalBytes: Uint8Array,
  targetBytes: number,
  onProgress?: ProgressFn
): Promise<{ bytes: Uint8Array }> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const srcDoc = await pdfjs.getDocument({ data: originalBytes.slice() }).promise;
  const pageCount = srcDoc.numPages;

  const sizeDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const pageSizes = sizeDoc.getPages().map((p) => p.getSize());

  const combos = [
    { scale: 1.4, quality: 0.6 },
    { scale: 1.2, quality: 0.5 },
    { scale: 1.0, quality: 0.4 },
    { scale: 0.85, quality: 0.32 },
    { scale: 0.7, quality: 0.22 },
    { scale: 0.55, quality: 0.15 },
    { scale: 0.4, quality: 0.12 },
  ];

  let best: { bytes: Uint8Array } | null = null;

  for (const combo of combos) {
    onProgress?.(
      `Rendering ${pageCount} page${pageCount > 1 ? "s" : ""} at ${Math.round(combo.scale * 100)}% resolution…`,
      0.5
    );

    try {
      const outDoc = await PDFDocument.create();
      for (let i = 1; i <= pageCount; i++) {
        const page = await srcDoc.getPage(i);
        const viewport = page.getViewport({ scale: combo.scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg", combo.quality)
        );
        if (!blob) continue;

        const jpgBytes = new Uint8Array(await blob.arrayBuffer());
        const jpgImage = await outDoc.embedJpg(jpgBytes);
        const size = pageSizes[i - 1] ?? { width: canvas.width * (72 / 96), height: canvas.height * (72 / 96) };
        const outPage = outDoc.addPage([size.width, size.height]);
        outPage.drawImage(jpgImage, { x: 0, y: 0, width: size.width, height: size.height });
      }

      const bytes = await outDoc.save({ useObjectStreams: true });
      if (!best || Math.abs(bytes.byteLength - targetBytes) < Math.abs(best.bytes.byteLength - targetBytes)) {
        best = { bytes };
      }
      if (bytes.byteLength <= targetBytes) break;
    } catch {
      continue;
    }
  }

  if (!best) throw new Error("Rasterization failed.");
  return best;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`;
}
