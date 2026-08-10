import { useState } from "react";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

type Status = "idle" | "loading-model" | "working" | "done" | "error";

export default function RemoveBackgroundTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);

  const onFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStatus("idle");
    setDownloadUrl(null);
  };

  const run = async () => {
    if (!file) return;
    setStatus("loading-model");
    setMessage("Downloading the segmentation model (first run only, ~10–20s)…");
    try {
      const module = await import("@imgly/background-removal");
      const removeBackground = module.default || module.removeBackground;
      setStatus("working");
      setMessage("Removing background…");
      const blob = await removeBackground(file, {
        progress: (key: string, current: number, total: number) => {
          setMessage(`${key}: ${Math.round((current / Math.max(total, 1)) * 100)}%`);
        },
      });
      setFinalSize(blob.size);
      setDownloadUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setMessage("Couldn't process that image. It needs to load a model from a CDN on first use — check your connection and try again.");
      setStatus("error");
    }
  };

  if (!file) {
    return (
      <UploadDrop
        accept="image/png,image/jpeg,image/webp"
        label="Drop a photo here"
        hint="Works best on a single clear subject"
        onFile={onFile}
      />
    );
  }

  return (
    <div className="bracket-card p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">File</p>
          <p className="font-medium truncate max-w-xs md:max-w-md">{file.name}</p>
          <p className="font-mono text-xs text-[var(--fg-muted)] mt-0.5">{formatBytes(file.size)}</p>
        </div>
        <button onClick={() => { setFile(null); setStatus("idle"); }} className="font-mono text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline shrink-0">
          Choose another file
        </button>
      </div>

      {previewUrl && status !== "done" && (
        <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto mb-6 border border-[var(--line)]" />
      )}

      {status !== "done" && (
        <button
          onClick={run}
          disabled={status === "working" || status === "loading-model"}
          className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {status === "loading-model" || status === "working" ? "Processing…" : "Remove background"}
        </button>
      )}

      {(status === "loading-model" || status === "working") && (
        <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">{message}</p>
      )}
      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">{message}</p>}

      {status === "done" && downloadUrl && (
        <div className="animate-rise">
          <div
            className="mx-auto mb-6 max-h-64 w-fit border border-[var(--line)] p-2"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          >
            <img src={downloadUrl} alt="Background removed" className="max-h-60" />
          </div>
          <p className="font-mono text-xs text-[var(--fg-muted)] mb-3 text-center">
            {finalSize !== null && formatBytes(finalSize)} · transparent PNG
          </p>
          <div className="flex justify-center">
            <a
              href={downloadUrl}
              download={file.name.replace(/\.[^.]+$/, "") + "-no-bg.png"}
              className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Download PNG
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
