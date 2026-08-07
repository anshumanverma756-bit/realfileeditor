import { useState } from "react";
import JSZip from "jszip";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

type Status = "idle" | "working" | "done" | "error";

export default function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [pages, setPages] = useState<{ name: string; url: string; size: number }[]>([]);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const onFile = (f: File) => {
    setFile(f);
    setStatus("idle");
    setPages([]);
    setZipUrl(null);
  };

  const run = async () => {
    if (!file) return;
    setStatus("working");
    setMessage("Loading PDF engine…");
    try {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const zip = new JSZip();
      const out: { name: string; url: string; size: number }[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        setMessage(`Rendering page ${i} of ${doc.numPages}…`);
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9));
        if (!blob) continue;
        const name = `${file.name.replace(/\.pdf$/i, "")}-page-${i}.jpg`;
        zip.file(name, blob);
        out.push({ name, url: URL.createObjectURL(blob), size: blob.size });
      }

      setPages(out);
      if (out.length > 1) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        setZipUrl(URL.createObjectURL(zipBlob));
      }
      setStatus("done");
    } catch (err) {
      console.error(err);
      setMessage("Couldn't render that PDF. Try another file.");
      setStatus("error");
    }
  };

  if (!file) {
    return <UploadDrop accept="application/pdf" label="Drop a PDF here" hint="Every page becomes a JPG" onFile={onFile} />;
  }

  return (
    <div className="bracket-card p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">File</p>
          <p className="font-medium truncate max-w-xs md:max-w-md">{file.name}</p>
          <p className="font-mono text-xs text-[var(--fg-muted)] mt-0.5">{formatBytes(file.size)}</p>
        </div>
        <button onClick={() => { setFile(null); setStatus("idle"); }} className="font-mono text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline shrink-0">
          Choose another file
        </button>
      </div>

      {status !== "done" && (
        <button
          onClick={run}
          disabled={status === "working"}
          className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {status === "working" ? "Rendering…" : "Convert to JPG"}
        </button>
      )}

      {status === "working" && <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">{message}</p>}
      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">{message}</p>}

      {status === "done" && pages.length > 0 && (
        <div className="animate-rise">
          {zipUrl && (
            <a href={zipUrl} download={`${file.name.replace(/\.pdf$/i, "")}-pages.zip`} className="inline-flex items-center h-11 px-8 mb-5 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
              Download all as ZIP
            </a>
          )}
          <ul className="space-y-2">
            {pages.map((p) => (
              <li key={p.name} className="flex items-center justify-between border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2.5">
                <span className="text-sm truncate">{p.name}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--fg-muted)]">{formatBytes(p.size)}</span>
                  <a href={p.url} download={p.name} className="font-mono text-xs text-[var(--accent)] underline">Download</a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
