import { rawText } from "@/lib/jsonTools";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/lib/types";

interface Props {
  nodes: TreeNode[];
  hits: Int32Array;
  activeIndex: number;
  onSelect: (index: number) => void;
  hasQuery: boolean;
}

/** Only a window of hits is ever mounted — huge result sets stay cheap. */
const RENDER_LIMIT = 300;

export function MatchLedger({ nodes, hits, activeIndex, onSelect, hasQuery }: Props) {
  const start = Math.max(0, Math.min(activeIndex - 40, hits.length - RENDER_LIMIT));
  const from = Math.max(0, start);
  const to = Math.min(hits.length, from + RENDER_LIMIT);
  const window: number[] = [];
  for (let i = from; i < to; i++) window.push(i);

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
          {window.map((i) => {
            const node = nodes[hits[i]];
            if (!node) return null;
            return (
              <li key={node.path}>
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
                  <span className="block truncate text-muted-foreground">{node.path}</span>
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
        {hits.length > window.length && (
          <p className="px-3 py-2 font-mono text-[10px] text-t-null">
            showing {from + 1}–{to} of {hits.length} — step through to see more
          </p>
        )}
      </div>
    </section>
  );
}
