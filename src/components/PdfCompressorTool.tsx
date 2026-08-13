import { useMemo, useState } from "react";
import UploadDrop from "./UploadDrop";
import GaugeSlider from "./GaugeSlider";
import { compressPdfToTarget, formatBytes, type CompressResult } from "../lib/compress-pdf";

type Status = "idle" | "ready" | "compressing" | "done" | "error";

export default function PdfCompressorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<number>(0);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CompressResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const min = useMemo(() => (file ? Math.max(Math.round(file.size * 0.1), 8 * 1024) : 0), [file]);
  const max = file?.size ?? 0;

  const onFile = (f: File) => {
    setFile(f);
    setResult(null);
    setDownloadUrl(null);
    const suggested = Math.round(f.size * 0.5);
    setTarget(Math.max(suggested, Math.max(Math.round(f.size * 0.1), 8 * 1024)));
    setStatus("ready");
  };

  const runCompression = async () => {
    if (!file) return;
    setStatus("compressing");
    setMessage("Reading file…");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await compressPdfToTarget(bytes, target, (msg) => setMessage(msg));
      setResult(res);
      const blob = new Blob([res.bytes as BlobPart], { type: "application/pdf" });
      setDownloadUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setMessage("Something went wrong compressing that file. Try a different target size.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setDownloadUrl(null);
    setStatus("idle");
  };

  if (!file) {
    return (
      <UploadDrop
        accept="application/pdf"
        label="Drop a PDF here"
        hint="or choose one from your device — up to 100 MB"
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

      <div className="mt-8">
        {status !== "done" && (
          <button
            onClick={runCompression}
            disabled={status === "compressing"}
            className="w-full md:w-auto inline-flex items-center justify-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {status === "compressing" ? "Compressing…" : `Compress to ${formatBytes(target)}`}
          </button>
        )}

        {status === "compressing" && (
          <p className="mt-3 font-mono text-xs text-[var(--fg-muted)] animate-tick-in">{message}</p>
        )}

        {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">{message}</p>}

        {status === "done" && result && downloadUrl && (
          <div className="animate-rise">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Stat label="Original" value={formatBytes(result.originalSize)} />
              <Stat
                label="Compressed"
                value={formatBytes(result.finalSize)}
                accent
              />
              <Stat
                label="Saved"
                value={`${Math.max(0, Math.round((1 - result.finalSize / result.originalSize) * 100))}%`}
                accent
              />
            </div>

            {result.rasterized && (
              <p className="text-sm text-[var(--fg-muted)] mb-4">
                <span className="text-[var(--fg)] font-medium">Heads up: </span>
                this PDF had little or nothing to compress as images, so pages were rendered to images and
                rebuilt to reach your target. The text is no longer selectable or searchable in the result —
                only use this if a smaller file matters more than that.
              </p>
            )}

            {!result.hitTarget && (
              <p className="text-sm text-[var(--fg-muted)] mb-4">
                This file's floor with browser-side compression is {formatBytes(result.finalSize)} — a little above
                your {formatBytes(target)} target. This is the smallest we could get without pages becoming
                difficult to read.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <a
                href={downloadUrl}
                download={file.name.replace(/\.pdf$/i, "") + "-compressed.pdf"}
                className="inline-flex items-center justify-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Download compressed PDF
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
