import type { RowComponentProps } from "react-window";
import { JsonNode } from "@/components/JsonNode";
import type { SearchScope, TreeNode } from "@/lib/types";

export interface MatchQuery {
  query: string;
  scope: SearchScope;
  caseSensitive: boolean;
  regex: boolean;
}

export interface RowData {
  rows: TreeNode[];
  /** 1 when the node at that flat index is a search hit */
  matched: Uint8Array;
  /** 1 when the container at that flat index is expanded */
  expanded: Uint8Array;
  activeNode: number;
  copiedPath: string | null;
  match: MatchQuery | null;
  onToggle: (index: number, deep: boolean) => void;
  onCopyPath: (path: string) => void;
}

export function VirtualRow({
  index,
  style,
  rows,
  matched,
  expanded,
  activeNode,
  copiedPath,
  match,
  onToggle,
  onCopyPath,
}: RowComponentProps<RowData>) {
  const node = rows[index];
  return (
    <div style={style}>
      <JsonNode
        node={node}
        match={matched[node.i] === 1 ? match : null}
        isActive={activeNode === node.i}
        isExpanded={expanded[node.i] === 1}
        copied={copiedPath === node.path}
        onToggle={onToggle}
        onCopyPath={onCopyPath}
      />
    </div>
  );
}
