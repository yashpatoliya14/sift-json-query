import { cn } from "@/lib/utils";

interface Props {
  ms: number | null;
  label?: string;
  className?: string;
}

/** Query-time readout. The bolt fires on every new timing. */
export function LightningZap({ ms, label = "query", className }: Props) {
  if (ms === null) return null;
  return (
    <span
      key={`${label}-${ms}`}
      className={cn(
        "zap-in inline-flex items-center gap-1 border border-border px-1.5 py-0.5 font-mono text-[10px] text-brass",
        className,
      )}
      title={`${label} completed in ${ms.toFixed(2)} ms`}
    >
      <svg viewBox="0 0 12 16" className="h-3 w-2.5" fill="currentColor" aria-hidden="true">
        <path d="M7 0L0 9h4l-1 7 8-10H7l2-6z" />
      </svg>
      {ms < 1 ? ms.toFixed(2) : Math.round(ms)} ms
    </span>
  );
}
