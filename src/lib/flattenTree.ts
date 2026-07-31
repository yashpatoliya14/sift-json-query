import type { JsonValue, JsonStats, NodeKind, TreeNode } from "./types";

export function kindOf(value: JsonValue): NodeKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "object";
  }
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function joinPath(parent: string, key: string, inArray: boolean): string {
  if (inArray) return `${parent}[${key}]`;
  return IDENT.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

/** Depth-first flatten of a JSON document into an addressable row list. */
export function buildNodes(root: JsonValue): TreeNode[] {
  const out: TreeNode[] = [];

  const walk = (value: JsonValue, key: string, path: string, parent: string | null, depth: number) => {
    const kind = kindOf(value);
    const isContainer = kind === "object" || kind === "array";
    const index = out.length;
    const node: TreeNode = {
      i: index,
      path,
      parent,
      key,
      depth,
      kind,
      value: isContainer ? undefined : (value as string | number | boolean | null),
      childCount: 0,
      isContainer,
      end: index + 1,
    };
    out.push(node);

    if (kind === "array") {
      const arr = value as JsonValue[];
      node.childCount = arr.length;
      arr.forEach((item, i) => walk(item, String(i), joinPath(path, String(i), true), path, depth + 1));
    } else if (kind === "object") {
      const entries = Object.entries(value as Record<string, JsonValue>);
      node.childCount = entries.length;
      for (const [k, v] of entries) walk(v, k, joinPath(path, k, false), path, depth + 1);
    }
    node.end = out.length;
  };

  walk(root, "$", "$", null, 0);
  return out;
}

export function computeStats(nodes: TreeNode[], bytes: number): JsonStats {
  let leaves = 0;
  let containers = 0;
  let depth = 0;
  for (const n of nodes) {
    if (n.isContainer) containers++;
    else leaves++;
    if (n.depth > depth) depth = n.depth;
  }
  return { nodes: nodes.length, leaves, containers, depth, bytes };
}

/** Rows currently visible given the expanded mask (collapsed subtrees are skipped). */
export function visibleRows(nodes: TreeNode[], expanded: Uint8Array): TreeNode[] {
  const rows: TreeNode[] = [];
  let i = 0;
  const len = nodes.length;
  while (i < len) {
    const node = nodes[i];
    rows.push(node);
    if (node.isContainer && expanded[i] !== 1) {
      i = node.end;
    } else {
      i += 1;
    }
  }
  return rows;
}
