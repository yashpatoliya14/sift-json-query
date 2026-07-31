import { compactNumber } from "@/lib/jsonTools";

interface Props {
  nodeCount: number;
  matchCount: number;
  hasQuery: boolean;
}

export function Header({ nodeCount, matchCount, hasQuery }: Props) {
  return (
    <header className="flex shrink-0 items-end justify-between gap-6 border-b border-border-strong bg-panel px-5 py-3">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-2xl leading-none font-extrabold tracking-[-0.04em] text-brass">
          SIFT
        </span>
        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
          json field &amp; value explorer
        </span>
      </div>

      <div className="flex items-center gap-5">
        <Readout label="nodes" value={compactNumber(nodeCount)} />
        <Readout
          label="matches"
          value={hasQuery ? compactNumber(matchCount) : "—"}
          accent={hasQuery && matchCount > 0}
        />
        <span className="hidden font-mono text-[10px] tracking-[0.18em] text-t-null uppercase md:inline">
          local only
        </span>
      </div>
    </header>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="eyebrow leading-none">{label}</div>
      <div
        className={`font-mono text-sm leading-tight tabular-nums ${accent ? "text-mark" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
