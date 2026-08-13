import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

interface PageThumb {
  index: number; // original index in the source PDF
  url: string;
}

type Status = "idle" | "loading" | "ready" | "saving" | "done" | "error";

export default function OrganizePdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);
  const sourceBytes = useRef<Uint8Array | null>(null);

  const onFile = async (f: File) => {
    setFile(f);
    setStatus("loading");
    setMessage("Rendering page thumbnails…");
    setDownloadUrl(null);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      sourceBytes.current = bytes;

      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const thumbs: PageThumb[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        thumbs.push({ index: i - 1, url: canvas.toDataURL("image/jpeg", 0.7) });
      }
      setPages(thumbs);
      setStatus("ready");
    } catch (err) {
      console.error(err);
      setMessage("Couldn't render that PDF's pages. Try another file.");
      setStatus("error");
    }
  };

  const onDragStart = (i: number) => (dragIndex.current = i);
  const onDropAt = (i: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === i) return;
    setPages((p) => {
      const copy = [...p];
      const [moved] = copy.splice(from, 1);
      copy.splice(i, 0, moved);
      return copy;
    });
  };

  const removePage = (i: number) => setPages((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!sourceBytes.current || pages.length === 0) return;
    setStatus("saving");
    try {
      const src = await PDFDocument.load(sourceBytes.current, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map((p) => p.index));
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      setFinalSize(bytes.byteLength);
      setDownloadUrl(URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" })));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setPages([]);
    setStatus("idle");
    setDownloadUrl(null);
  };

  if (!file) {
    return <UploadDrop accept="application/pdf" label="Drop a PDF here" hint="Drag thumbnails to reorder, remove pages you don't need" onFile={onFile} />;
  }

  return (
    <div className="bracket-card p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-(--fg-muted)">File</p>
          <p className="font-medium truncate max-w-xs md:max-w-md">{file.name}</p>
          <p className="font-mono text-xs text-(--fg-muted) mt-0.5">{pages.length} pages · {formatBytes(file.size)}</p>
        </div>
        <button onClick={reset} className="font-mono text-xs text-(--fg-muted) hover:text-(--fg) underline shrink-0">
          Choose another file
        </button>
      </div>

      {status === "loading" && <p className="font-mono text-xs text-(--fg-muted)">{message}</p>}
      {status === "error" && <p className="text-sm text-[var(--color-danger)]">{message}</p>}

      {pages.length > 0 && (
        <>
          <p className="font-mono text-[11px] uppercase tracking-wider text-(--fg-muted) mb-3">Drag to reorder · click ✕ to remove</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-6">
            {pages.map((p, i) => (
              <div
                key={`${p.index}-${i}`}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropAt(i)}
                className="relative border border-[var(--line)] bg-[var(--bg-raised)] cursor-grab active:cursor-grabbing group"
              >
                <img src={p.url} alt={`Page ${p.index + 1}`} className="w-full block" />
                <span className="absolute bottom-1 left-1 font-mono text-[10px] bg-[var(--bg)]/90 px-1">{i + 1}</span>
                <button
                  onClick={() => removePage(i)}
                  aria-label={`Remove page ${i + 1}`}
                  className="absolute top-1 right-1 h-5 w-5 grid place-items-center bg-[var(--bg)]/90 border border-[var(--line)] text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--color-danger)]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {status !== "done" && (
            <button
              onClick={save}
              disabled={status === "saving" || pages.length === 0}
              className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : `Save ${pages.length}-page PDF`}
            </button>
          )}

          {status === "done" && downloadUrl && (
            <div className="animate-rise">
              <p className="font-mono text-xs text-(--fg-muted) mb-3">{finalSize !== null && formatBytes(finalSize)}</p>
              <a
                href={downloadUrl}
                download={file.name.replace(/\.pdf$/i, "") + "-organized.pdf"}
                className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Download organized PDF
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
