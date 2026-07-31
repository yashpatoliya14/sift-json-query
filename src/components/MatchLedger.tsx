import { rawText } from "@/lib/jsonTools";
import { cn } from "@/lib/utils";
import type { MatchHit, TreeNode } from "@/lib/types";

interface Props {
  hits: MatchHit[];
  nodeIndex: Map<string, TreeNode>;
  activeIndex: number;
  onSelect: (index: number) => void;
  hasQuery: boolean;
}

export function MatchLedger({ hits, nodeIndex, activeIndex, onSelect, hasQuery }: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="eyebrow">match ledger</h2>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {hits.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        {!hasQuery && (
          <p className="px-3 py-3 font-mono text-[11px] text-t-null">
            Search to list every hit with its path and value.
          </p>
        )}
        {hasQuery && hits.length === 0 && (
          <p className="px-3 py-3 font-mono text-[11px] text-t-null">No matches in this document.</p>
        )}
        <ul>
          {hits.map((hit, i) => {
            const node = nodeIndex.get(hit.path);
            if (!node) return null;
            return (
              <li key={hit.path}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className={cn(
                    "block w-full border-b border-border px-3 py-1.5 text-left font-mono text-[11px] transition-colors",
                    i === activeIndex
                      ? "bg-[color-mix(in_oklab,var(--mark)_16%,transparent)]"
                      : "hover:bg-panel-raised",
                  )}
                >
                  <span className="block truncate text-muted-foreground">{hit.path}</span>
                  <span className="mt-0.5 flex gap-1.5 truncate">
                    <span className="text-brass">{node.key}</span>
                    <span className="truncate text-t-string">
                      {node.isContainer ? `${node.childCount} children` : rawText(node)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
