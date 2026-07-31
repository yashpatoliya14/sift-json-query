import type { RowComponentProps } from "react-window";
import { JsonNode } from "@/components/JsonNode";
import type { MatchHit, TreeNode } from "@/lib/types";

export interface RowData {
  rows: TreeNode[];
  hits: Map<string, MatchHit>;
  expanded: Set<string>;
  activePath: string | null;
  copiedPath: string | null;
  onToggle: (path: string, deep: boolean) => void;
  onCopyPath: (path: string) => void;
}

export function VirtualRow({
  index,
  style,
  rows,
  hits,
  expanded,
  activePath,
  copiedPath,
  onToggle,
  onCopyPath,
}: RowComponentProps<RowData>) {
  const node = rows[index];
  return (
    <div style={style}>
      <JsonNode
        node={node}
        hit={hits.get(node.path)}
        isActive={activePath === node.path}
        isExpanded={expanded.has(node.path)}
        copied={copiedPath === node.path}
        onToggle={onToggle}
        onCopyPath={onCopyPath}
      />
    </div>
  );
}
