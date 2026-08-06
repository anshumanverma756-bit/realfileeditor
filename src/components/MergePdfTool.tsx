import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { formatBytes } from "../lib/compress-pdf";

interface QueuedFile {
  id: string;
  file: File;
}

export default function MergePdfTool() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [status, setStatus] = useState<"idle" | "merging" | "done" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type === "application/pdf")
      .map((f) => ({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`, file: f }));
    setQueue((q) => [...q, ...next]);
    setStatus("idle");
    setDownloadUrl(null);
  };

  const removeFile = (id: string) => setQueue((q) => q.filter((f) => f.id !== id));

  const onDragStart = (i: number) => (dragIndex.current = i);
  const onDropAt = (i: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === i) return;
    setQueue((q) => {
      const copy = [...q];
      const [moved] = copy.splice(from, 1);
      copy.splice(i, 0, moved);
      return copy;
    });
  };

  const merge = async () => {
    if (queue.length < 2) return;
    setStatus("merging");
    try {
      const outDoc = await PDFDocument.create();
      for (const { file } of queue) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await outDoc.copyPages(src, src.getPageIndices());
        pages.forEach((p) => outDoc.addPage(p));
      }
      const bytes = await outDoc.save();
      setFinalSize(bytes.byteLength);
      setDownloadUrl(URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" })));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className="bracket-card p-6 md:p-10">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="sr-only"
        onChange={(e) => addFiles(e.target.files)}
      />

      {queue.length === 0 ? (
        <div
          className="text-center py-10"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <p className="font-display font-medium text-lg">Drop two or more PDFs here</p>
          <p className="text-sm text-[var(--fg-muted)] mt-1">They'll merge in the order you drag them below</p>
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
            {queue.length} file{queue.length > 1 ? "s" : ""} · drag to reorder
          </p>
          <ul className="space-y-2 mb-6">
            {queue.map((q, i) => (
              <li
                key={q.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropAt(i)}
                className="flex items-center gap-3 border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2.5 cursor-grab active:cursor-grabbing"
              >
                <span className="font-mono text-xs text-[var(--fg-muted)] w-5">{i + 1}</span>
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
                onClick={merge}
                disabled={queue.length < 2 || status === "merging"}
                className="inline-flex items-center h-10 px-5 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {status === "merging" ? "Merging…" : `Merge ${queue.length} PDFs`}
              </button>
            )}
          </div>

          {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">One of those files couldn't be read as a PDF. Remove it and try again.</p>}

          {status === "done" && downloadUrl && (
            <div className="mt-6 animate-rise">
              <p className="font-mono text-xs text-[var(--fg-muted)] mb-3">Merged file · {finalSize !== null && formatBytes(finalSize)}</p>
              <a
                href={downloadUrl}
                download="merged.pdf"
                className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Download merged PDF
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
