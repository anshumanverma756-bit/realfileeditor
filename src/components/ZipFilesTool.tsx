import { useRef, useState } from "react";
import JSZip from "jszip";
import { formatBytes } from "../lib/compress-pdf";

interface QueuedFile {
  id: string;
  file: File;
}

export default function ZipFilesTool() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [status, setStatus] = useState<"idle" | "zipping" | "done" | "error">("idle");
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [zipSize, setZipSize] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
      file: f,
    }));
    setQueue((q) => [...q, ...next]);
    setStatus("idle");
    setZipUrl(null);
  };

  const removeFile = (id: string) => setQueue((q) => q.filter((f) => f.id !== id));
  const totalSize = queue.reduce((sum, q) => sum + q.file.size, 0);

  const run = async () => {
    if (queue.length === 0) return;
    setStatus("zipping");
    try {
      const zip = new JSZip();
      for (const { file } of queue) {
        zip.file(file.name, file);
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
      setZipSize(blob.size);
      setZipUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const reset = () => {
    setQueue([]);
    setZipUrl(null);
    setStatus("idle");
  };

  return (
    <div className="bracket-card p-6 md:p-10">
      <input ref={inputRef} type="file" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />

      {queue.length === 0 ? (
        <div
          className="text-center py-10"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <p className="font-display font-medium text-lg">Drop any files here</p>
          <p className="text-sm text-[var(--fg-muted)] mt-1">PDFs, images, documents — any mix, any count</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-5 inline-flex items-center h-10 px-5 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Choose files
          </button>
        </div>
      ) : (
        <>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)] mb-3">
            {queue.length} file{queue.length > 1 ? "s" : ""} · {formatBytes(totalSize)} total
          </p>
          <ul className="space-y-2 mb-6">
            {queue.map((q) => (
              <li key={q.id} className="flex items-center gap-3 border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2.5">
                <span className="flex-1 truncate text-sm">{q.file.name}</span>
                <span className="font-mono text-xs text-[var(--fg-muted)]">{formatBytes(q.file.size)}</span>
                <button onClick={() => removeFile(q.id)} aria-label={`Remove ${q.file.name}`} className="text-[var(--fg-muted)] hover:text-[var(--color-danger)] font-mono text-xs">
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center h-10 px-5 border border-[var(--line)] text-sm font-medium hover:border-[var(--accent)] transition-colors"
            >
              Add more files
            </button>
            {status !== "done" && (
              <button
                onClick={run}
                disabled={status === "zipping"}
                className="inline-flex items-center h-10 px-5 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {status === "zipping" ? "Zipping…" : `Zip ${queue.length} file${queue.length > 1 ? "s" : ""}`}
              </button>
            )}
            {queue.length > 0 && (
              <button onClick={reset} className="inline-flex items-center h-10 px-5 font-mono text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline">
                Clear all
              </button>
            )}
          </div>

          {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">Something went wrong building the zip. Try again.</p>}

          {status === "done" && zipUrl && (
            <div className="mt-6 animate-rise">
              <p className="font-mono text-xs text-[var(--fg-muted)] mb-3">
                archive.zip · {zipSize !== null && formatBytes(zipSize)}
              </p>
              <a
                href={zipUrl}
                download="archive.zip"
                className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Download .zip
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
