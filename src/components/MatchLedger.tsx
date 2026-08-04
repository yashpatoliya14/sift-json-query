import { useState } from "react";

import { CopyIcon } from "@/components/icons";
import { copyText } from "@/lib/jsonTools";
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
  const [copied, setCopied] = useState<string | null>(null);

  const copyPair = async (item: LedgerItem) => {
    await copyText(`${item.key}: ${item.preview}`);
    setCopied(item.path);
    setTimeout(() => setCopied((p) => (p === item.path ? null : p)), 1200);
  };

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
            <li key={item.path} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(item.index)}
                className={cn(
                  "block w-full border-b border-border px-3 py-1.5 pr-9 text-left font-mono text-[11px] transition-colors",
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

              <button
                type="button"
                onClick={() => void copyPair(item)}
                aria-label={`Copy ${item.key} value`}
                title="Copy key: value"
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-panel-raised px-1.5 py-1",
                  "font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity",
                  "hover:text-brass focus-visible:opacity-100 group-hover:opacity-100",
                  copied === item.path && "opacity-100 text-brass",
                )}
              >
                {copied === item.path ? "ok" : <CopyIcon className="h-3 w-3" />}
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
