import { useCallback, useRef, useState } from "react";

interface UploadDropProps {
  accept: string;
  label: string;
  hint: string;
  onFile: (file: File) => void;
}

export default function UploadDrop({ accept, label, hint, onFile }: UploadDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFile(files[0]);
    },
    [onFile]
  );

  return (
    <div
      className={`bracket-card p-10 md:p-14 text-center transition-colors ${
        isOver ? "border-[var(--accent)] bg-[var(--accent-dim)]" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mx-auto mb-4 h-12 w-12 grid place-items-center border border-[var(--line)]" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 3v12" strokeLinecap="round" />
          <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-display font-medium text-lg">{label}</p>
      <p className="text-sm text-[var(--fg-muted)] mt-1">{hint}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-5 inline-flex items-center h-10 px-5 bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Choose file
      </button>
      <p className="mt-3 font-mono text-[11px] text-[var(--fg-muted)]">or drag it in — nothing uploads until you press compress</p>
    </div>
  );
}
