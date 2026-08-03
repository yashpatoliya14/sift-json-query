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

/**
 * Iterative depth-first flatten of a JSON document into an addressable row list.
 *
 * Iterative (explicit stack) so deeply nested documents cannot blow the call
 * stack, and it avoids Object.entries()' pair allocation per object.
 */
interface Frame {
  node: TreeNode;
  keys: string[] | null; // null => array
  arr: JsonValue[] | null;
  obj: Record<string, JsonValue> | null;
  i: number;
  inArray: boolean;
}

export function buildNodes(root: JsonValue): TreeNode[] {
  const out: TreeNode[] = [];

  const make = (value: JsonValue, key: string, path: string, parent: string | null, depth: number): TreeNode => {
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
    return node;
  };

  const push = (stack: Frame[], value: JsonValue, node: TreeNode) => {
    if (node.kind === "array") {
      const arr = value as JsonValue[];
      node.childCount = arr.length;
      stack.push({ node, keys: null, arr, obj: null, i: 0, inArray: true });
    } else {
      const obj = value as Record<string, JsonValue>;
      const keys = Object.keys(obj);
      node.childCount = keys.length;
      stack.push({ node, keys, arr: null, obj, i: 0, inArray: false });
    }
  };

  const rootNode = make(root, "$", "$", null, 0);
  if (!rootNode.isContainer) return out;

  const stack: Frame[] = [];
  push(stack, root, rootNode);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const len = frame.inArray ? frame.arr!.length : frame.keys!.length;
    if (frame.i >= len) {
      frame.node.end = out.length;
      stack.pop();
      continue;
    }
    const idx = frame.i++;
    const key = frame.inArray ? String(idx) : frame.keys![idx];
    const value = frame.inArray ? frame.arr![idx] : frame.obj![key];
    const path = joinPath(frame.node.path, key, frame.inArray);
    const child = make(value, key, path, frame.node.path, frame.node.depth + 1);
    if (child.isContainer) push(stack, value, child);
  }

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
