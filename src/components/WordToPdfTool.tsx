import { useState } from "react";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

type Status = "idle" | "working" | "done" | "error";

/**
 * Honest scope: mammoth.js converts the .docx's text, headings, lists and
 * basic inline formatting to HTML; jsPDF then renders that HTML to a PDF.
 * Complex layouts (multi-column, precise page breaks, embedded objects)
 * won't come through pixel-perfect — this covers the common case of
 * turning a text document into a shareable PDF.
 */
export default function WordToPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const onFile = (f: File) => {
    setFile(f);
    setStatus("idle");
    setDownloadUrl(null);
  };

  const run = async () => {
    if (!file) return;
    setStatus("working");
    setMessage("Reading document…");
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

      setMessage("Laying out PDF…");
      const html2canvas = (await import("html2canvas")).default;
      (window as any).html2canvas = html2canvas;
      const { jsPDF } = await import("jspdf");

      const container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-9999px;top:0;width:700px;padding:24px;background:#fff;color:#111;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;";
      container.innerHTML = html;
      document.body.appendChild(container);

      const doc = new jsPDF({ unit: "pt", format: "a4" });

      await new Promise<void>((resolve, reject) => {
        doc.html(container, {
          margin: [40, 40, 40, 40],
          autoPaging: "text",
          width: 515, // a4 width in pt minus margins
          windowWidth: 700,
          callback: () => resolve(),
          html2canvas: { scale: 0.75 },
        });
        setTimeout(() => reject(new Error("timeout")), 30000);
      });

      document.body.removeChild(container);

      const blob = doc.output("blob");
      setDownloadUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setMessage("Couldn't convert that document. Make sure it's a valid .docx file.");
      setStatus("error");
    }
  };

  if (!file) {
    return <UploadDrop accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" label="Drop a .docx here" hint="Text, headings and basic formatting convert to PDF" onFile={onFile} />;
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

      <p className="text-xs text-[var(--fg-muted)] mb-6">
        Converts text, headings, lists and basic formatting. Complex layouts and embedded objects may not
        come through exactly as in Word.
      </p>

      {status !== "done" && (
        <button
          onClick={run}
          disabled={status === "working"}
          className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {status === "working" ? "Converting…" : "Convert to PDF"}
        </button>
      )}

      {status === "working" && <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">{message}</p>}
      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">{message}</p>}

      {status === "done" && downloadUrl && (
        <div className="mt-6 animate-rise">
          <a
            href={downloadUrl}
            download={file.name.replace(/\.docx$/i, "") + ".pdf"}
            className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
}
