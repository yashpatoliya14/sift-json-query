import { cn } from "@/lib/utils";

export interface LedgerItem {
  /** position within the full hit list */
  index: number;
  path: string;
  key: string;
  preview: string;
}

interface Props {
  items: LedgerItem[];
  total: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  hasQuery: boolean;
}

export function MatchLedger({ items, total, activeIndex, onSelect, hasQuery }: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="eyebrow">match ledger</h2>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{total}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        {!hasQuery && (
          <p className="px-3 py-3 font-mono text-[11px] text-t-null">
            Search to list every hit with its path and value.
          </p>
        )}
        {hasQuery && total === 0 && (
          <p className="px-3 py-3 font-mono text-[11px] text-t-null">No matches in this document.</p>
        )}
        <ul>
          {items.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                onClick={() => onSelect(item.index)}
                className={cn(
                  "block w-full border-b border-border px-3 py-1.5 text-left font-mono text-[11px] transition-colors",
                  item.index === activeIndex
                    ? "bg-[color-mix(in_oklab,var(--mark)_16%,transparent)]"
                    : "hover:bg-panel-raised",
                )}
              >
                <span className="block truncate text-muted-foreground">{item.path}</span>
                <span className="mt-0.5 flex gap-1.5 truncate">
                  <span className="text-brass">{item.key}</span>
                  <span className="truncate text-t-string">{item.preview}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {total > items.length && (
          <p className="px-3 py-2 font-mono text-[10px] text-t-null">
            showing {items.length ? items[0].index + 1 : 0}–{items.length ? items[items.length - 1].index + 1 : 0} of{" "}
            {total} — step through to see more
          </p>
        )}
      </div>
    </section>
  );
}
