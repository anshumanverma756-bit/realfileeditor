import imageCompression from "browser-image-compression";

export interface ImageCompressResult {
  file: File;
  originalSize: number;
  finalSize: number;
}

/**
 * Compresses an image toward a target size. browser-image-compression
 * genuinely iterates quality/dimensions internally to approach
 * maxSizeMB, so this is a real target-size compressor, not a preset.
 */
export async function compressImageToTarget(
  file: File,
  targetBytes: number,
  onProgress?: (fraction: number) => void
): Promise<ImageCompressResult> {
  const targetMB = Math.max(targetBytes / (1024 * 1024), 0.02);

  const compressed = await imageCompression(file, {
    maxSizeMB: targetMB,
    useWebWorker: true,
    initialQuality: 0.85,
    onProgress: (p: number) => onProgress?.(p / 100),
  });

  return {
    file: compressed,
    originalSize: file.size,
    finalSize: compressed.size,
  };
}
