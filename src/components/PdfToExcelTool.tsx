import { useState } from "react";
import UploadDrop from "./UploadDrop";
import { formatBytes } from "../lib/compress-pdf";

declare module "pdfjs-dist";
declare module "pdfjs-dist/build/pdf.worker.min.mjs?url";

type Status = "idle" | "working" | "done" | "error";
export default function PdfToExcelTool() {
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
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      let totalItems = 0;

      for (let i = 1; i <= doc.numPages; i++) {
        setMessage(`Reading page ${i} of ${doc.numPages}…`);
        const page = await doc.getPage(i);
        const content = await page.getTextContent();

        type Item = { str: string; x: number; y: number };
        const items: Item[] = content.items
          .filter((it: any) => "str" in it && it.str.trim() !== "")
          .map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
        totalItems += items.length;

        // Group into rows by y-position (PDF y grows upward, so sort descending).
        const rowTolerance = 3;
        const rows: Item[][] = [];
        items
          .sort((a, b) => b.y - a.y || a.x - b.x)
          .forEach((item) => {
            const row = rows.find((r) => Math.abs(r[0].y - item.y) <= rowTolerance);
            if (row) row.push(item);
            else rows.push([item]);
          });

        // Within each row, split into columns wherever the horizontal gap
        // between items is wider than a typical character width.
        const columnGapThreshold = 10;
        const aoa: string[][] = rows.map((row) => {
          const sorted = row.sort((a, b) => a.x - b.x);
          const cells: string[] = [];
          let current = sorted[0]?.str ?? "";
          let lastX = sorted[0]?.x ?? 0;
          for (let k = 1; k < sorted.length; k++) {
            const gap = sorted[k].x - lastX;
            if (gap > columnGapThreshold) {
              cells.push(current.trim());
              current = sorted[k].str;
            } else {
              current += sorted[k].str;
            }
            lastX = sorted[k].x;
          }
          if (current) cells.push(current.trim());
          return cells;
        });

        const sheet = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [["(no extractable text on this page)"]]);
        const name = `Page ${i}`.slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      }

      if (totalItems === 0) {
        setMessage("This PDF doesn't have a text layer to extract (it's likely a scan).");
        setStatus("error");
        return;
      }

      const wbBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      setDownloadUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      console.error(err);
      setMessage("Couldn't read that PDF. Try another file.");
      setStatus("error");
    }
  };

  if (!file) {
    return <UploadDrop accept="application/pdf" label="Drop a PDF here" hint="Reconstructs rows and columns into a spreadsheet" onFile={onFile} />;
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
        Works best on simple tables and plain text. Complex multi-column layouts or merged cells won't
        reconstruct perfectly — each page becomes its own sheet so you can check the result.
      </p>

      {status !== "done" && (
        <button
          onClick={run}
          disabled={status === "working"}
          className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {status === "working" ? "Converting…" : "Convert to Excel"}
        </button>
      )}

      {status === "working" && <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">{message}</p>}
      {status === "error" && <p className="mt-3 text-sm text-[var(--color-danger)]">{message}</p>}

      {status === "done" && downloadUrl && (
        <div className="mt-6 animate-rise">
          <a
            href={downloadUrl}
            download={file.name.replace(/\.pdf$/i, "") + ".xlsx"}
            className="inline-flex items-center h-11 px-8 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Download spreadsheet
          </a>
        </div>
      )}
    </div>
  );
}
