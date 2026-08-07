import { useState } from "react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

export default function WatermarkPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(0.25);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);

  const onFile = (f: File) => {
    setFile(f);
    setStatus("idle");
    setDownloadUrl(null);
  };

  const run = async () => {
    if (!file || !text.trim()) return;
    setStatus("working");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const size = 48;

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity,
          rotate: degrees(45),
        });
      }

      const outBytes = await doc.save();
      setFinalSize(outBytes.byteLength);
      setDownloadUrl(URL.createObjectURL(new Blob([outBytes as BlobPart], { type: "application/pdf" })));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (!file) {
    return <UploadDrop accept="application/pdf" label="Drop a PDF here" hint="We'll stamp text diagonally across every page" onFile={onFile} />;
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

      <label className="block mb-4">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">Watermark text</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={40}
          className="mt-1.5 w-full border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block mb-6">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">Opacity: {Math.round(opacity * 100)}%</span>
        <input
          type="range"
          min={0.05}
          max={0.6}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="mt-1.5 w-full accent-[var(--accent)]"
        />
      </label>

      <button
        onClick={run}
        disabled={status === "working" || !text.trim()}
        className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {status === "working" ? "Stamping…" : "Add watermark"}
      </button>

      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">Couldn't read that PDF — try another file.</p>}

      {status === "done" && downloadUrl && (
        <div className="mt-6 animate-rise">
          <p className="font-mono text-xs text-[var(--fg-muted)] mb-3">{finalSize !== null && formatBytes(finalSize)}</p>
          <a
            href={downloadUrl}
            download={file.name.replace(/\.pdf$/i, "") + "-watermarked.pdf"}
            className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Download watermarked PDF
          </a>
        </div>
      )}
    </div>
  );
}
