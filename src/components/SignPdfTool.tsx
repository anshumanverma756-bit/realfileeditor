import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
type Status = "idle" | "working" | "done" | "error";

export default function SignPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [targetPage, setTargetPage] = useState(1);
  const [corner, setCorner] = useState<Corner>("bottom-right");
  const [sizePct, setSizePct] = useState(25);
  const [hasSignature, setHasSignature] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [finalSize, setFinalSize] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const onFile = async (f: File) => {
    setFile(f);
    setStatus("idle");
    setDownloadUrl(null);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const count = doc.getPageCount();
    setPageCount(count);
    setTargetPage(count);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#12151b";
  }, [file]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };
  const endDraw = () => (drawing.current = false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const run = async () => {
    if (!file || !canvasRef.current || !hasSignature) return;
    setStatus("working");
    try {
      const sigDataUrl = canvasRef.current.toDataURL("image/png");
      const sigBytes = await (await fetch(sigDataUrl)).arrayBuffer();

      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const sigImage = await doc.embedPng(sigBytes);

      const page = doc.getPage(Math.min(Math.max(targetPage - 1, 0), doc.getPageCount() - 1));
      const { width: pw, height: ph } = page.getSize();

      const sigW = pw * (sizePct / 100);
      const sigH = sigW * (sigImage.height / sigImage.width);
      const margin = pw * 0.04;

      let x = margin;
      let y = margin;
      if (corner === "bottom-right") { x = pw - sigW - margin; y = margin; }
      if (corner === "bottom-left") { x = margin; y = margin; }
      if (corner === "top-right") { x = pw - sigW - margin; y = ph - sigH - margin; }
      if (corner === "top-left") { x = margin; y = ph - sigH - margin; }
      if (corner === "center") { x = (pw - sigW) / 2; y = (ph - sigH) / 2; }

      page.drawImage(sigImage, { x, y, width: sigW, height: sigH });

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
    return <UploadDrop accept="application/pdf" label="Drop a PDF here" hint="Then draw a signature and place it on a page" onFile={onFile} />;
  }

  return (
    <div className="bracket-card p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">File</p>
          <p className="font-medium truncate max-w-xs md:max-w-md">{file.name}</p>
          <p className="font-mono text-xs text-[var(--fg-muted)] mt-0.5">{pageCount} pages · {formatBytes(file.size)}</p>
        </div>
        <button onClick={() => { setFile(null); setStatus("idle"); }} className="font-mono text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline shrink-0">
          Choose another file
        </button>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)] mb-2">Draw your signature</p>
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        className="w-full max-w-md border border-[var(--line)] bg-white touch-none"
      />
      <button onClick={clearSignature} className="mt-2 font-mono text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline">
        Clear
      </button>

      <div className="grid grid-cols-2 gap-4 mt-6 mb-6 max-w-md font-mono text-sm">
        <label className="flex flex-col gap-1">
          Page
          <input type="number" min={1} max={pageCount} value={targetPage} onChange={(e) => setTargetPage(Number(e.target.value))} className="border border-[var(--line)] bg-[var(--bg-raised)] px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Size: {sizePct}%
          <input type="range" min={10} max={60} value={sizePct} onChange={(e) => setSizePct(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["top-left", "top-right", "center", "bottom-left", "bottom-right"] as Corner[]).map((c) => (
          <button
            key={c}
            onClick={() => setCorner(c)}
            className={`h-9 px-3 text-xs font-mono border ${corner === c ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--line)]"}`}
          >
            {c.replace("-", " ")}
          </button>
        ))}
      </div>

      <button
        onClick={run}
        disabled={status === "working" || !hasSignature}
        className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {status === "working" ? "Placing signature…" : "Sign PDF"}
      </button>

      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">Couldn't sign that PDF — try another file.</p>}

      {status === "done" && downloadUrl && (
        <div className="mt-6 animate-rise">
          <p className="font-mono text-xs text-[var(--fg-muted)] mb-3">{finalSize !== null && formatBytes(finalSize)}</p>
          <a
            href={downloadUrl}
            download={file.name.replace(/\.pdf$/i, "") + "-signed.pdf"}
            className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Download signed PDF
          </a>
        </div>
      )}
    </div>
  );
}
