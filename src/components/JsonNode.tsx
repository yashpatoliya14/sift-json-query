import { useMemo } from "react";
import { Highlight } from "@/components/Highlight";
import { ChevronIcon, CopyIcon } from "@/components/icons";
import { findRanges, rawText } from "@/lib/jsonTools";
import { cn } from "@/lib/utils";
import type { MatchQuery } from "@/components/VirtualRow";
import type { TreeNode } from "@/lib/types";

export interface JsonNodeProps {
  node: TreeNode;
  /** non-null when this row is a hit — ranges are computed lazily, only for rendered rows */
  match: MatchQuery | null;
  isActive: boolean;
  isExpanded: boolean;
  copied: boolean;
  onToggle: (index: number, deep: boolean) => void;
  onCopyPath: (path: string) => void;
}

const valueClass: Record<string, string> = {
  string: "text-t-string",
  number: "text-t-number",
  boolean: "text-t-boolean",
  null: "text-t-null italic",
};

export function JsonNode({
  node,
  match,
  isActive,
  isExpanded,
  copied,
  onToggle,
  onCopyPath,
}: JsonNodeProps) {
  const text = rawText(node);

  const ranges = useMemo(() => {
    if (!match) return { key: undefined, value: undefined };
    const opts = { caseSensitive: match.caseSensitive, regex: match.regex };
    try {
      return {
        key: match.scope === "values" ? undefined : findRanges(node.key, match.query, opts),
        value:
          match.scope === "keys" || node.isContainer
            ? undefined
            : findRanges(text, match.query, opts),
      };
    } catch {
      return { key: undefined, value: undefined };
    }
  }, [match, node.key, node.isContainer, text]);

  return (
    <div
      className={cn(
        "group flex h-full items-center gap-2 pr-3 font-mono text-[13px]",
        isActive && "bg-[color-mix(in_oklab,var(--mark)_12%,transparent)]",
        !isActive && "hover:bg-panel-raised/60",
      )}
      style={{ paddingLeft: `${node.depth * 14 + 8}px` }}
    >
      {node.isContainer ? (
        <button
          type="button"
          onClick={(e) => onToggle(node.i, e.altKey || e.shiftKey)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.path}`}
          className="shrink-0 text-muted-foreground transition-colors hover:text-brass"
        >
          <ChevronIcon
            className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")}
          />
        </button>
      ) : (
        <span className="w-3.5 shrink-0 text-center text-border-strong">·</span>
      )}

      <button
        type="button"
        onClick={() => (node.isContainer ? onToggle(node.i, false) : onCopyPath(node.path))}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="shrink-0 text-brass">
          <Highlight text={node.key} ranges={ranges.key} activeRange={isActive ? 0 : -1} />
          {node.key !== "$" && <span className="text-muted-foreground">:</span>}
        </span>

        {node.isContainer ? (
          <span className="truncate text-muted-foreground">
            {node.kind === "array" ? "[" : "{"}
            <span className="text-t-null">
              {node.childCount} {node.kind === "array" ? "items" : "keys"}
            </span>
            {node.kind === "array" ? "]" : "}"}
          </span>
        ) : (
          <span className={cn("truncate", valueClass[node.kind])}>
            {node.kind === "string" && <span className="text-t-null">&quot;</span>}
            <Highlight text={text} ranges={ranges.value} activeRange={isActive ? 0 : -1} />
            {node.kind === "string" && <span className="text-t-null">&quot;</span>}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onCopyPath(node.path)}
        aria-label={`Copy path ${node.path}`}
        className={cn(
          "shrink-0 text-[10px] transition-opacity",
          copied ? "text-mark opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-brass",
        )}
      >
        {copied ? "copied" : <CopyIcon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
