import { formatBytes } from "@/lib/readFile";

interface Props {
  phase: string;
  pct: number;
  fileName?: string | null;
  fileSize?: number | null;
}

/** Full-screen ingest curtain — the app is unusable mid-load anyway. */
export function LoadingOverlay({ phase, pct, fileName, fileSize }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[color-mix(in_oklab,var(--background)_92%,transparent)] backdrop-blur-sm"
    >
      <div className="w-[min(420px,80vw)] panel-frame px-5 py-5">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">loading</span>
          <span className="font-mono text-[10px] tabular-nums text-brass">{Math.round(pct)}%</span>
        </div>

        {fileName && (
          <p className="mt-2 truncate font-mono text-[12px] text-t-string">
            {fileName}
            {fileSize ? <span className="text-muted-foreground"> · {formatBytes(fileSize)}</span> : null}
          </p>
        )}

        <div className="mt-3 h-[3px] w-full bg-panel-raised">
          <div
            className="h-full bg-brass transition-[width] duration-150"
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[10px] tracking-wide text-brass">{phase}…</p>
      </div>
    </div>
  );
}
