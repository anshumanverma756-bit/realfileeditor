import { useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

export default function RotatePdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState(90);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);

  const onFile = (f: File) => {
    setFile(f);
    setStatus("idle");
    setDownloadUrl(null);
  };

  const run = async () => {
    if (!file) return;
    setStatus("working");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (const page of doc.getPages()) {
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + angle) % 360));
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
    return <UploadDrop accept="application/pdf" label="Drop a PDF here" hint="Every page rotates together" onFile={onFile} />;
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

      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)] mb-3">Rotate</p>
      <div className="flex gap-2 mb-6">
        {[90, 180, 270].map((a) => (
          <button
            key={a}
            onClick={() => setAngle(a)}
            className={`h-9 px-4 text-sm border ${angle === a ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--line)]"}`}
          >
            {a}°
          </button>
        ))}
      </div>

      <button
        onClick={run}
        disabled={status === "working"}
        className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {status === "working" ? "Rotating…" : `Rotate ${angle}°`}
      </button>

      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">Couldn't read that PDF — try another file.</p>}

      {status === "done" && downloadUrl && (
        <div className="mt-6 animate-rise">
          <p className="font-mono text-xs text-[var(--fg-muted)] mb-3">{finalSize !== null && formatBytes(finalSize)}</p>
          <a
            href={downloadUrl}
            download={file.name.replace(/\.pdf$/i, "") + "-rotated.pdf"}
            className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Download rotated PDF
          </a>
        </div>
      )}
    </div>
  );
}
