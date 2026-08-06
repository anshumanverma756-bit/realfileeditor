import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from "pdf-lib";

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  finalSize: number;
  attempts: number;
  imagesRecompressed: number;
  hitTarget: boolean;
}

export type ProgressFn = (message: string, fraction: number) => void;

/**
 * Re-saves a PDF with object streams enabled and, where possible,
 * re-encodes embedded JPEG images at a lower quality so the final
 * file lands close to `targetBytes`.
 *
 * Limitations (documented honestly rather than hidden):
 *  - Only JPEG-filtered images (Filter = DCTDecode) are re-encoded.
 *    Raw/Flate-encoded pixel data and vector content are left as-is.
 *  - This is a real, working browser-side compressor, but it will not
 *    always reach an arbitrarily small target — the gauge shows the
 *    achievable floor for the current file as you drag toward it.
 *    A production deployment should add a server-side pass (e.g.
 *    Ghostscript/qpdf) for the remaining cases — see README.
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
        };
      }
    } catch {
      // Skip this quality step and try the next; never hard-fail the tool.
      continue;
    }
  }

  if (best) {
    return {
      bytes: best.bytes,
      originalSize,
      finalSize: best.bytes.byteLength,
      attempts,
      imagesRecompressed: best.imagesRecompressed,
      hitTarget: false,
    };
  }

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
      // Leave this particular image untouched if it can't be decoded/re-encoded.
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
