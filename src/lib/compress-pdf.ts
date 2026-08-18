import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from "pdf-lib";

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  finalSize: number;
  attempts: number;
  imagesRecompressed: number;
  hitTarget: boolean;
  /** True if the original was already at/under target — nothing was done. */
  skipped: boolean;
  /** True if pages were rasterized to hit the target — text is no longer selectable/searchable. */
  rasterized: boolean;
}

export type ProgressFn = (message: string, fraction: number) => void;

const TOLERANCE = 0.03; // "close enough" = within 3% of target, used only for UI wording

/**
 * Three-stage compressor:
 *
 * Stage 0 — if the file is already at or under the target, don't touch it.
 *
 * Stage 1 — re-encode embedded JPEG images (Filter = DCTDecode) at lower
 * quality and re-save with object streams. Preserves selectable text and
 * vector content untouched. Only helps when the PDF's size is dominated by
 * photos; it's a no-op on text/table PDFs.
 *
 * Stage 2 — rasterize: render every page ONCE at a high base resolution
 * and cache those bitmaps, then search a genuine 2D grid of
 * (resolution scale × JPEG quality) — downscaling the cached bitmap and
 * re-encoding at each step, rather than re-invoking the (expensive) PDF
 * page renderer per attempt. This is what makes different targets actually
 * produce different output sizes instead of bottoming out at one fixed
 * floor: the search space is wide enough, and cheap enough per step, to
 * keep narrowing in on whatever target was requested.
 */
export async function compressPdfToTarget(
  originalBytes: Uint8Array,
  targetBytes: number,
  onProgress?: ProgressFn
): Promise<CompressResult> {
  const originalSize = originalBytes.byteLength;

  if (originalSize <= targetBytes) {
    return {
      bytes: originalBytes,
      originalSize,
      finalSize: originalSize,
      attempts: 0,
      imagesRecompressed: 0,
      hitTarget: true,
      skipped: true,
      rasterized: false,
    };
  }

  const qualitySteps = [0.85, 0.7, 0.55, 0.4, 0.28, 0.18];
  let best: { bytes: Uint8Array; imagesRecompressed: number } | null = null;
  let attempts = 0;

  for (const quality of qualitySteps) {
    attempts++;
    onProgress?.(`Re-encoding images at ${Math.round(quality * 100)}% quality…`, (attempts / qualitySteps.length) * 0.4);

    try {
      const { bytes, imagesRecompressed } = await recompressOnce(originalBytes, quality);
      if (!best || bytes.byteLength < best.bytes.byteLength) {
        best = { bytes, imagesRecompressed };
      }
      if (bytes.byteLength <= targetBytes && (await isValidPdf(bytes))) {
        return {
          bytes,
          originalSize,
          finalSize: bytes.byteLength,
          attempts,
          imagesRecompressed,
          hitTarget: true,
          skipped: false,
          rasterized: false,
        };
      }
      // No embedded JPEGs to touch — every quality step produces an
      // identical result, so stop wasting time and move to rasterizing.
      if (imagesRecompressed === 0) break;
    } catch {
      continue;
    }
  }

  onProgress?.("Rendering pages to reach your target…", 0.45);
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
    const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const bytes = await doc.save({ useObjectStreams: true });
    return {
      bytes,
      originalSize,
      finalSize: bytes.byteLength,
      attempts,
      imagesRecompressed: 0,
      hitTarget: bytes.byteLength <= targetBytes,
      skipped: false,
      rasterized: false,
    };
  }

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
    hitTarget: pick.bytes.byteLength <= targetBytes * (1 + TOLERANCE),
    skipped: false,
    rasterized: pick.rasterized,
  };
}

async function isValidPdf(bytes: Uint8Array): Promise<boolean> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.getPageCount() > 0;
  } catch {
    return false;
  }
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

interface PageBitmap {
  canvas: HTMLCanvasElement;
  sizePt: { width: number; height: number };
}

/**
 * Renders every page ONCE at a generous base resolution and caches the
 * result, then searches a real grid of (scale × quality) by cheaply
 * downscaling/re-encoding those cached canvases — never re-invoking the
 * PDF renderer per attempt. That's what lets this reach meaningfully
 * different sizes for meaningfully different targets, instead of bottoming
 * out at one fixed floor regardless of what was requested.
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
  const pageSizesPt = sizeDoc.getPages().map((p) => p.getSize());

  const BASE_SCALE = 1.6;
  onProgress?.(`Rendering ${pageCount} page${pageCount > 1 ? "s" : ""}…`, 0.5);
  const basePages: PageBitmap[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await srcDoc.getPage(i);
    const viewport = page.getViewport({ scale: BASE_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    basePages.push({ canvas, sizePt: pageSizesPt[i - 1] ?? { width: canvas.width * (72 / 96), height: canvas.height * (72 / 96) } });
  }

  let best: { bytes: Uint8Array } | null = null;
  const track = (bytes: Uint8Array) => {
    if (!best || Math.abs(bytes.byteLength - targetBytes) < Math.abs(best.bytes.byteLength - targetBytes)) {
      best = { bytes };
    }
    return bytes.byteLength <= targetBytes;
  };

  // Phase 1 — lossless PNG at a couple of resolutions. Right tool for
  // flat-color, sharp-edged content (tables, screenshots): JPEG's chroma
  // subsampling can smear/shift colors badly on that kind of content,
  // especially at low quality. Only a couple of tries since PNG usually
  // can't reach small targets on photo/scan-heavy pages.
  for (const scale of [1.0, 0.7, 0.45]) {
    onProgress?.(`Trying lossless at ${Math.round(scale * 100)}%…`, 0.55);
    try {
      const bytes = await buildPdfFromPages(basePages, BASE_SCALE, scale, "image/png");
      if (track(bytes) && (await isValidPdf(bytes))) return { bytes };
    } catch {
      continue;
    }
  }

  // Phase 2 — real 2D search: for each of several resolution scales,
  // binary-search JPEG quality to land as close as possible to the target
  // at that resolution. Quality floor is 0.18 — low enough to reach small
  // targets, high enough to avoid severe chroma-subsampling artifacts.
  const scales = [1.0, 0.85, 0.7, 0.58, 0.48, 0.4, 0.32, 0.26, 0.2, 0.15];
  for (const scale of scales) {
    onProgress?.(`Searching quality at ${Math.round(scale * 100)}% resolution…`, 0.6);
    try {
      const result = await binarySearchQualityForPdf(basePages, BASE_SCALE, scale, targetBytes);
      if (track(result.bytes) && (await isValidPdf(result.bytes))) return { bytes: result.bytes };
    } catch {
      continue;
    }
  }

  if (!best) throw new Error("Rasterization failed.");
  return best;
}

async function binarySearchQualityForPdf(
  pages: PageBitmap[],
  baseScale: number,
  scale: number,
  targetBytes: number
): Promise<{ bytes: Uint8Array }> {
  let lowQ = 0.18;
  let highQ = 0.92;
  let best: { bytes: Uint8Array } | null = null;

  for (let i = 0; i < 6; i++) {
    const quality = (lowQ + highQ) / 2;
    const bytes = await buildPdfFromPages(pages, baseScale, scale, "image/jpeg", quality);
    if (!best || Math.abs(bytes.byteLength - targetBytes) < Math.abs(best.bytes.byteLength - targetBytes)) {
      best = { bytes };
    }
    if (bytes.byteLength > targetBytes) highQ = quality;
    else lowQ = quality;
  }

  if (!best) throw new Error("Quality search failed.");
  return best;
}

async function buildPdfFromPages(
  pages: PageBitmap[],
  baseScale: number,
  scale: number,
  mime: "image/png" | "image/jpeg",
  quality?: number
): Promise<Uint8Array> {
  const outDoc = await PDFDocument.create();
  const relativeScale = scale / baseScale;

  for (const { canvas: baseCanvas, sizePt } of pages) {
    let sourceCanvas = baseCanvas;
    if (relativeScale < 0.999) {
      const w = Math.max(1, Math.round(baseCanvas.width * relativeScale));
      const h = Math.max(1, Math.round(baseCanvas.height * relativeScale));
      const small = document.createElement("canvas");
      small.width = w;
      small.height = h;
      const sctx = small.getContext("2d");
      if (sctx) {
        if (mime === "image/jpeg") {
          sctx.fillStyle = "#ffffff";
          sctx.fillRect(0, 0, w, h);
        }
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(baseCanvas, 0, 0, w, h);
        sourceCanvas = small;
      }
    } else if (mime === "image/jpeg") {
      // Full resolution but still need a white background flattened in for JPEG.
      const flat = document.createElement("canvas");
      flat.width = baseCanvas.width;
      flat.height = baseCanvas.height;
      const fctx = flat.getContext("2d");
      if (fctx) {
        fctx.fillStyle = "#ffffff";
        fctx.fillRect(0, 0, flat.width, flat.height);
        fctx.drawImage(baseCanvas, 0, 0);
        sourceCanvas = flat;
      }
    }

    const blob: Blob | null = await new Promise((resolve) => sourceCanvas.toBlob((b) => resolve(b), mime, quality));
    if (!blob) continue;

    const imgBytes = new Uint8Array(await blob.arrayBuffer());
    const image = mime === "image/png" ? await outDoc.embedPng(imgBytes) : await outDoc.embedJpg(imgBytes);
    const outPage = outDoc.addPage([sizePt.width, sizePt.height]);
    outPage.drawImage(image, { x: 0, y: 0, width: sizePt.width, height: sizePt.height });
  }

  return outDoc.save({ useObjectStreams: true });
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
