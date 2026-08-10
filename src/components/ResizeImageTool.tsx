import { useEffect, useState } from "react";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

type Status = "idle" | "working" | "done" | "error";
type Mode = "pixels" | "percent";

export default function ResizeImageTool() {
  const [file, setFile] = useState<File | null>(null);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [mode, setMode] = useState<Mode>("pixels");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [percent, setPercent] = useState(50);
  const [lockRatio, setLockRatio] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);

  const onFile = (f: File) => {
    const img = new Image();
    img.onload = () => {
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
    setFile(f);
    setStatus("idle");
    setDownloadUrl(null);
  };

  const onWidthChange = (w: number) => {
    setWidth(w);
    if (lockRatio && naturalW > 0) setHeight(Math.round((w * naturalH) / naturalW));
  };

  const onHeightChange = (h: number) => {
    setHeight(h);
    if (lockRatio && naturalH > 0) setWidth(Math.round((h * naturalW) / naturalH));
  };

  useEffect(() => {
    if (mode === "percent" && naturalW > 0) {
      setWidth(Math.round((naturalW * percent) / 100));
      setHeight(Math.round((naturalH * percent) / 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent, mode]);

  const run = async () => {
    if (!file || width <= 0 || height <= 0) return;
    setStatus("working");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);
      const type = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, 0.92));
      if (!blob) throw new Error("resize failed");
      setFinalSize(blob.size);
      setDownloadUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (!file) {
    return (
      <UploadDrop
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        label="Drop an image here"
        hint="Set exact pixel dimensions or scale by percentage"
        onFile={onFile}
      />
    );
  }

  return (
    <div className="bracket-card p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">File</p>
          <p className="font-medium truncate max-w-xs md:max-w-md">{file.name}</p>
          <p className="font-mono text-xs text-[var(--fg-muted)] mt-0.5">
            {naturalW}×{naturalH}px · {formatBytes(file.size)}
          </p>
        </div>
        <button onClick={() => { setFile(null); setStatus("idle"); }} className="font-mono text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline shrink-0">
          Choose another file
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setMode("pixels")} className={`h-9 px-4 text-sm border ${mode === "pixels" ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--line)]"}`}>
          Exact pixels
        </button>
        <button onClick={() => setMode("percent")} className={`h-9 px-4 text-sm border ${mode === "percent" ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--line)]"}`}>
          Percentage
        </button>
      </div>

      {mode === "pixels" ? (
        <div className="flex items-end gap-4 font-mono text-sm mb-2">
          <label className="flex flex-col gap-1">
            Width
            <input type="number" min={1} value={width} onChange={(e) => onWidthChange(Number(e.target.value))} className="w-24 border border-[var(--line)] bg-[var(--bg-raised)] px-2 py-1.5" />
          </label>
          <span className="pb-1.5 text-[var(--fg-muted)]">×</span>
          <label className="flex flex-col gap-1">
            Height
            <input type="number" min={1} value={height} onChange={(e) => onHeightChange(Number(e.target.value))} className="w-24 border border-[var(--line)] bg-[var(--bg-raised)] px-2 py-1.5" />
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-xs text-[var(--fg-muted)]">
            <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} />
            Lock ratio
          </label>
        </div>
      ) : (
        <div className="mb-2">
          <p className="font-mono text-sm mb-2">{percent}% → {width}×{height}px</p>
          <input type="range" min={5} max={200} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </div>
      )}

      <button
        onClick={run}
        disabled={status === "working"}
        className="mt-6 inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {status === "working" ? "Resizing…" : `Resize to ${width}×${height}`}
      </button>

      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">Couldn't resize that image — try different dimensions.</p>}

      {status === "done" && downloadUrl && (
        <div className="mt-6 animate-rise">
          <p className="font-mono text-xs text-[var(--fg-muted)] mb-3">{finalSize !== null && formatBytes(finalSize)}</p>
          <a
            href={downloadUrl}
            download={file.name.replace(/\.[^.]+$/, "") + `-${width}x${height}` + file.name.match(/\.[^.]+$/)?.[0]}
            className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Download resized image
          </a>
        </div>
      )}
    </div>
  );
}
