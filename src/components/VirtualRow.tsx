import { createContext, useContext } from "react";
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

const EMPTY_ROW_DATA: RowData = {
  rows: [],
  matched: new Uint8Array(0),
  expanded: new Uint8Array(0),
  activeNode: -1,
  copiedPath: null,
  match: null,
  onToggle: () => {},
  onCopyPath: () => {},
};

/**
 * Row data travels by context, never as react-window rowProps: passing the flat
 * node list to every row makes React re-walk a huge object per rendered row.
 */
export const TreeDataContext = createContext<RowData>(EMPTY_ROW_DATA);

export function VirtualRow({ index, style }: RowComponentProps<Record<string, never>>) {
  const { rows, matched, expanded, activeNode, copiedPath, match, onToggle, onCopyPath } =
    useContext(TreeDataContext);
  const node = rows[index];
  if (!node) return null;
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
