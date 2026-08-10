import { useState } from "react";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

type Status = "idle" | "working" | "done" | "error";

/**
 * Honest scope: this extracts the text layer from each page and lays it
 * out as paragraphs in a real, editable .docx — it does not reproduce the
 * original layout, fonts, images or tables. For scanned PDFs (no text
 * layer), there's nothing to extract; a warning is shown in that case.
 */
export default function PdfToWordTool() {
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
    setMessage("Extracting text…");
    try {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes }).promise;

      const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
      const children: InstanceType<typeof Paragraph>[] = [];
      let totalChars = 0;

      for (let i = 1; i <= doc.numPages; i++) {
        setMessage(`Reading page ${i} of ${doc.numPages}…`);
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ").trim();
        totalChars += text.length;

        children.push(
          new Paragraph({ text: `Page ${i}`, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } })
        );
        if (text) {
          children.push(new Paragraph({ children: [new TextRun(text)], spacing: { after: 200 } }));
        } else {
          children.push(
            new Paragraph({ children: [new TextRun({ text: "(No extractable text on this page — likely a scanned image.)", italics: true })] })
          );
        }
      }

      if (totalChars === 0) {
        setMessage("This PDF doesn't have a text layer to extract (it's likely a scan). Try OCR first, or a text-based PDF.");
        setStatus("error");
        return;
      }

      const docx = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(docx);
      setDownloadUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setMessage("Couldn't read that PDF. Try another file.");
      setStatus("error");
    }
  };

  if (!file) {
    return <UploadDrop accept="application/pdf" label="Drop a PDF here" hint="Extracts the text into an editable .docx" onFile={onFile} />;
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
        This pulls the text layer out of the PDF into an editable Word document. It won't preserve the
        original layout, fonts or images — for that, keep working from the PDF directly.
      </p>

      {status !== "done" && (
        <button
          onClick={run}
          disabled={status === "working"}
          className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {status === "working" ? "Converting…" : "Convert to Word"}
        </button>
      )}

      {status === "working" && <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">{message}</p>}
      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">{message}</p>}

      {status === "done" && downloadUrl && (
        <div className="mt-6 animate-rise">
          <a
            href={downloadUrl}
            download={file.name.replace(/\.pdf$/i, "") + ".docx"}
            className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Download Word document
          </a>
        </div>
      )}
    </div>
  );
}
