import { useState } from "react";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

const FORMATS: { label: string; mime: string; ext: string }[] = [
  { label: "JPG", mime: "image/jpeg", ext: "jpg" },
  { label: "PNG", mime: "image/png", ext: "png" },
  { label: "WEBP", mime: "image/webp", ext: "webp" },
];

export default function ConvertImageTool() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState(FORMATS[0]);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);

  const onFile = (f: File) => {
    setFile(f);
    setStatus("idle");
    setDownloadUrl(null);
  };

  const convert = async () => {
    if (!file) return;
    setStatus("working");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      if (target.mime === "image/jpeg") {
        // JPEG has no alpha channel — flatten onto white first.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), target.mime, 0.92));
      if (!blob) throw new Error("conversion failed");
      setFinalSize(blob.size);
      setDownloadUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (!file) {
    return (
      <UploadDrop
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        label="Drop an image here"
        hint="Convert to JPG, PNG or WEBP"
        onFile={onFile}
      />
    );
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

      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)] mb-3">Convert to</p>
      <div className="flex gap-2 mb-6">
        {FORMATS.map((f) => (
          <button
            key={f.mime}
            onClick={() => setTarget(f)}
            className={`h-9 px-4 text-sm border ${target.mime === f.mime ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--line)]"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <button
        onClick={convert}
        disabled={status === "working"}
        className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {status === "working" ? "Converting…" : `Convert to ${target.label}`}
      </button>

      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">Couldn't convert that file — try a different source image.</p>}

      {status === "done" && downloadUrl && (
        <div className="mt-6 animate-rise">
          <p className="font-mono text-xs text-[var(--fg-muted)] mb-3">{finalSize !== null && formatBytes(finalSize)} · {target.label}</p>
          <a
            href={downloadUrl}
            download={file.name.replace(/\.[^.]+$/, "") + "." + target.ext}
            className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Download {target.label}
          </a>
        </div>
      )}
    </div>
  );
}
