import { useRef, useState } from "react";
import { UploadIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  onApply: (text: string) => void;
  onClear: () => void;
  onSample: () => void;
  error: string | null;
}

export function SourceControls({ text, onTextChange, onApply, onClear, onSample, error }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      onTextChange(content);
      onApply(content);
    };
    reader.readAsText(file);
  };

  return (
    <section className="flex min-h-0 flex-col border-b border-border">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="eyebrow">source</h2>
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
        accept=".json,.txt,application/json,text/plain"
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
        <textarea
          value={text}
          spellCheck={false}
          placeholder={'{ "paste": "your JSON here" }'}
          onChange={(e) => onTextChange(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted.trim()) {
              e.preventDefault();
              onTextChange(pasted);
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

        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onApply(text)}
            className="border border-brass bg-brass px-3 py-1 font-mono text-[11px] tracking-wide text-background transition-colors hover:bg-transparent hover:text-brass"
          >
            apply
          </button>
          <span className="font-mono text-[10px] text-t-null">⌘/ctrl + enter</span>
        </div>

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
