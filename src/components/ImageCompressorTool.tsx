import { useMemo, useState } from "react";
import UploadDrop from "./UploadDrop";
import GaugeSlider from "./GaugeSlider";
import { compressImageToTarget } from "../lib/compress-image";
import { formatBytes } from "../lib/compress-pdf";

type Status = "idle" | "ready" | "compressing" | "done" | "error";

export default function ImageCompressorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<number>(0);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [finalSize, setFinalSize] = useState<number | null>(null);
  const [hitTarget, setHitTarget] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outName, setOutName] = useState<string>("");

  const min = useMemo(() => (file ? Math.max(Math.round(file.size * 0.05), 5 * 1024) : 0), [file]);
  const max = file?.size ?? 0;

  const onFile = (f: File) => {
    setFile(f);
    setFinalSize(null);
    setDownloadUrl(null);
    const suggested = Math.round(f.size * 0.4);
    setTarget(Math.max(suggested, Math.max(Math.round(f.size * 0.05), 5 * 1024)));
    setStatus("ready");
  };

  const run = async () => {
    if (!file) return;
    setStatus("compressing");
    setMessage("Compressing…");
    try {
      const res = await compressImageToTarget(file, target, (msg) => setMessage(msg));
      setFinalSize(res.finalSize);
      setHitTarget(res.hitTarget);
      setOutName(res.file.name);
      setDownloadUrl(URL.createObjectURL(res.file));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setMessage("Couldn't compress that image. Try a slightly larger target size.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setFinalSize(null);
    setDownloadUrl(null);
    setStatus("idle");
  };

  if (!file) {
    return (
      <UploadDrop
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff"
        label="Drop an image here"
        hint="JPG, PNG, WEBP, GIF, BMP or TIFF"
        onFile={onFile}
      />
    );
  }

  return (
    <div className="bracket-card p-6 md:p-10 animate-rise">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">File</p>
          <p className="font-medium truncate max-w-xs md:max-w-md">{file.name}</p>
          <p className="font-mono text-xs text-[var(--fg-muted)] mt-0.5">{formatBytes(file.size)} original</p>
        </div>
        <button onClick={reset} className="font-mono text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline shrink-0">
          Choose another file
        </button>
      </div>

      <GaugeSlider min={min} max={max} value={target} onChange={setTarget} disabled={status === "compressing"} />

      <p className="mt-3 text-xs text-[var(--fg-muted)]">
        Compressing re-encodes the image as JPEG so quality can be tuned precisely to your target — PNG, GIF, BMP and
        TIFF inputs will lose transparency and come back as a .jpg.
      </p>

      <div className="mt-8">
        {status !== "done" && (
          <button
            onClick={run}
            disabled={status === "compressing"}
            className="w-full md:w-auto inline-flex items-center justify-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {status === "compressing" ? "Compressing…" : `Compress to ${formatBytes(target)}`}
          </button>
        )}

        {status === "compressing" && <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">{message}</p>}
        {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">{message}</p>}

        {status === "done" && finalSize !== null && downloadUrl && (
          <div className="animate-rise">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Stat label="Original" value={formatBytes(file.size)} />
              <Stat label="Compressed" value={formatBytes(finalSize)} accent />
              <Stat label="Saved" value={`${Math.max(0, Math.round((1 - finalSize / file.size) * 100))}%`} accent />
            </div>

            {!hitTarget && (
              <p className="text-sm text-[var(--fg-muted)] mb-4">
                This image's floor is {formatBytes(finalSize)} — a little above your target. It's already at the
                lowest quality and smallest dimensions that still hold together as a usable photo; going smaller
                would mean visibly degrading it further.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <a
                href={downloadUrl}
                download={outName}
                className="inline-flex items-center justify-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Download compressed image
              </a>
              <button
                onClick={reset}
                className="inline-flex items-center justify-center h-11 px-8 border border-[var(--line)] text-sm font-medium hover:border-[var(--accent)] transition-colors"
              >
                Compress another file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-muted)]">{label}</p>
      <p className={`font-mono text-lg font-medium mono-num ${accent ? "text-[var(--success)]" : ""}`}>{value}</p>
    </div>
  );
}
