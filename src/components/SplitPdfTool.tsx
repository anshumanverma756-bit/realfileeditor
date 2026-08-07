import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

type Mode = "range" | "every";

interface OutputFile {
  name: string;
  url: string;
  size: number;
}

export default function SplitPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<Mode>("range");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [everyN, setEveryN] = useState(1);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [outputs, setOutputs] = useState<OutputFile[]>([]);

  const onFile = async (f: File) => {
    setFile(f);
    setStatus("idle");
    setOutputs([]);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const count = doc.getPageCount();
    setPageCount(count);
    setFrom(1);
    setTo(count);
    setEveryN(Math.max(1, Math.ceil(count / 2)));
  };

  const run = async () => {
    if (!file) return;
    setStatus("working");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      const results: OutputFile[] = [];

      if (mode === "range") {
        const start = Math.max(1, Math.min(from, total)) - 1;
        const end = Math.max(1, Math.min(to, total)) - 1;
        const out = await PDFDocument.create();
        const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        const pages = await out.copyPages(src, indices);
        pages.forEach((p) => out.addPage(p));
        const outBytes = await out.save();
        results.push({
          name: `${file.name.replace(/\.pdf$/i, "")}-p${start + 1}-${end + 1}.pdf`,
          url: URL.createObjectURL(new Blob([outBytes as BlobPart], { type: "application/pdf" })),
          size: outBytes.byteLength,
        });
      } else {
        const n = Math.max(1, everyN);
        for (let start = 0; start < total; start += n) {
          const end = Math.min(start + n, total);
          const out = await PDFDocument.create();
          const indices = Array.from({ length: end - start }, (_, i) => start + i);
          const pages = await out.copyPages(src, indices);
          pages.forEach((p) => out.addPage(p));
          const outBytes = await out.save();
          results.push({
            name: `${file.name.replace(/\.pdf$/i, "")}-part-${Math.floor(start / n) + 1}.pdf`,
            url: URL.createObjectURL(new Blob([outBytes as BlobPart], { type: "application/pdf" })),
            size: outBytes.byteLength,
          });
        }
      }

      setOutputs(results);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (!file) {
    return <UploadDrop accept="application/pdf" label="Drop a PDF here" hint="We'll read the page count automatically" onFile={onFile} />;
  }

  return (
    <div className="bracket-card p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">File</p>
          <p className="font-medium truncate max-w-xs md:max-w-md">{file.name}</p>
          <p className="font-mono text-xs text-[var(--fg-muted)] mt-0.5">{pageCount} pages · {formatBytes(file.size)}</p>
        </div>
        <button onClick={() => { setFile(null); setOutputs([]); setStatus("idle"); }} className="font-mono text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline shrink-0">
          Choose another file
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("range")}
          className={`h-9 px-4 text-sm border ${mode === "range" ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--line)]"}`}
        >
          Extract a range
        </button>
        <button
          onClick={() => setMode("every")}
          className={`h-9 px-4 text-sm border ${mode === "every" ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--line)]"}`}
        >
          Split every N pages
        </button>
      </div>

      {mode === "range" ? (
        <div className="flex items-center gap-3 font-mono text-sm">
          <label className="flex items-center gap-2">
            From
            <input type="number" min={1} max={pageCount} value={from} onChange={(e) => setFrom(Number(e.target.value))} className="w-16 border border-[var(--line)] bg-[var(--bg-raised)] px-2 py-1" />
          </label>
          <label className="flex items-center gap-2">
            To
            <input type="number" min={1} max={pageCount} value={to} onChange={(e) => setTo(Number(e.target.value))} className="w-16 border border-[var(--line)] bg-[var(--bg-raised)] px-2 py-1" />
          </label>
          <span className="text-[var(--fg-muted)]">of {pageCount}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 font-mono text-sm">
          <label className="flex items-center gap-2">
            Pages per file
            <input type="number" min={1} max={pageCount} value={everyN} onChange={(e) => setEveryN(Number(e.target.value))} className="w-16 border border-[var(--line)] bg-[var(--bg-raised)] px-2 py-1" />
          </label>
          <span className="text-[var(--fg-muted)]">→ {Math.ceil(pageCount / Math.max(1, everyN))} files</span>
        </div>
      )}

      <button
        onClick={run}
        disabled={status === "working"}
        className="mt-6 inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {status === "working" ? "Splitting…" : "Split PDF"}
      </button>

      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">Check that the range is within 1–{pageCount}.</p>}

      {status === "done" && outputs.length > 0 && (
        <ul className="mt-6 space-y-2 animate-rise">
          {outputs.map((o) => (
            <li key={o.name} className="flex items-center justify-between border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2.5">
              <span className="text-sm truncate">{o.name}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs text-[var(--fg-muted)]">{formatBytes(o.size)}</span>
                <a href={o.url} download={o.name} className="font-mono text-xs text-[var(--accent)] underline">Download</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
