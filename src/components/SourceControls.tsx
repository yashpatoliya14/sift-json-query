import { useRef, useState } from "react";
import { UploadIcon } from "@/components/icons";
import { beginLoad, failLoad } from "@/lib/docStore";
import { ACCEPTED_EXTENSIONS, FORMAT_LABEL, formatFromFileName, type SourceFormat } from "@/lib/parseSource";
import { MAX_TEXT_BYTES, formatBytes, readFileText } from "@/lib/readFile";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  onApply: (text: string, bytes?: number, format?: SourceFormat | null) => void;
  onClear: () => void;
  onSample: () => void;
  onFileMeta?: (meta: { name: string; size: number } | null) => void;
  error: string | null;
  loading?: { phase: string; pct: number } | null;
  loadMs?: number;
  format?: SourceFormat | null;
}

/** Above this, the raw text never enters the textarea — a multi-MB controlled
 *  <textarea> is the single slowest thing you can do to the main thread. */
const EDITOR_LIMIT = 512 * 1024;

export function SourceControls({
  text,
  onTextChange,
  onApply,
  onClear,
  onSample,
  onFileMeta,
  error,
  loading,
  loadMs,
  format,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [bigFile, setBigFile] = useState<{ name: string; size: number } | null>(null);

  const readFile = async (file: File) => {
    onFileMeta?.({ name: file.name, size: file.size });
    if (file.size > MAX_TEXT_BYTES) {
      onFileMeta?.(null);
      failLoad(
        `${file.name} is ${formatBytes(file.size)} — browsers cap a single text document near ${formatBytes(
          MAX_TEXT_BYTES,
        )}. Split it or query a slice.`,
      );
      return;
    }

    beginLoad("reading file", 2);
    // Streams off-thread and reports progress while the bytes arrive.
    const content = await readFileText(file, (fraction) =>
      beginLoad(`reading file ${Math.round(fraction * 100)}%`, 2 + fraction * 25),
    );
    if (file.size > EDITOR_LIMIT) {
      setBigFile({ name: file.name, size: file.size });
      onTextChange("");
    } else {
      setBigFile(null);
      onTextChange(content);
    }
    onApply(content, file.size, formatFromFileName(file.name));
    onFileMeta?.(null);
  };



  return (
    <section className="flex min-h-0 flex-col border-b border-border">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="eyebrow">source{format ? ` · ${FORMAT_LABEL[format]}` : ""}</h2>
        <div className="flex items-center gap-1">
          <SmallButton onClick={onSample}>sample</SmallButton>
          <SmallButton onClick={() => fileRef.current?.click()}>
            <UploadIcon className="h-3 w-3" /> upload
          </SmallButton>
          <SmallButton onClick={onClear}>clear</SmallButton>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        className={cn("px-3 pb-3", dragging && "bg-panel-raised")}
      >
        {bigFile ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 border border-border bg-background px-3 text-center">
            <span className="font-mono text-[12px] text-t-string">{bigFile.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatBytes(bigFile.size)} loaded — too large to edit inline
            </span>
            <button
              type="button"
              onClick={() => setBigFile(null)}
              className="mt-1 border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-brass hover:text-brass"
            >
              show editor
            </button>
          </div>
        ) : (
          <textarea
            value={text}
            spellCheck={false}
            placeholder={'paste JSON, XML, YAML, TOML, CSV/TSV or NDJSON here'}
            onChange={(e) => onTextChange(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted.trim()) {
                e.preventDefault();
                if (pasted.length > EDITOR_LIMIT) {
                  setBigFile({ name: "pasted JSON", size: pasted.length });
                  onTextChange("");
                } else {
                  onTextChange(pasted);
                }
                onApply(pasted);
              }
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onApply(text);
              }
            }}
            className="h-40 w-full resize-none border border-border bg-background p-2 font-mono text-[12px] leading-relaxed text-foreground placeholder:text-t-null focus:border-brass focus:outline-none"
            aria-label="JSON source"
          />
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!!loading || bigFile !== null}
            onClick={() => onApply(text)}
            className="border border-brass bg-brass px-3 py-1 font-mono text-[11px] tracking-wide text-background transition-colors hover:bg-transparent hover:text-brass disabled:opacity-40"
          >
            apply
          </button>
          <span className="font-mono text-[10px] text-t-null">
            {loadMs && !loading ? `parsed in ${Math.round(loadMs)} ms` : "⌘/ctrl + enter"}
          </span>
        </div>

        {loading && (
          <div className="mt-2">
            <div className="h-[3px] w-full bg-panel-raised">
              <div
                className="h-full bg-brass transition-[width] duration-150"
                style={{ width: `${loading.pct}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-[10px] tracking-wide text-brass">{loading.phase}…</p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-2 border-l-2 border-destructive pl-2 font-mono text-[11px] text-destructive">
            {error}
          </p>
        )}

      </div>
    </section>
  );
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 border border-border px-2 py-1 font-mono text-[10px] tracking-wide text-muted-foreground transition-colors hover:border-brass hover:text-brass"
    >
      {children}
    </button>
  );
}
