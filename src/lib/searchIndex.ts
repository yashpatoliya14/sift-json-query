import type { SearchScope, TreeNode } from "./types";

/**
 * Column-oriented index built once per document. Searching then touches only
 * flat string arrays (no per-keystroke allocation, no property lookups), which
 * is what makes large files feel instant.
 */
export interface SearchIndex {
  size: number;
  keys: string[];
  /** lowercased columns — built lazily (the worker owns its own copies) */
  keysLower: string[] | null;
  vals: string[];
  valsLower: string[] | null;
  parent: Int32Array;
  container: Uint8Array;
}

export const MAX_HITS = 50_000;

export function buildSearchIndex(nodes: TreeNode[], parentIdx?: Int32Array): SearchIndex {
  const size = nodes.length;
  const keys = new Array<string>(size);
  const vals = new Array<string>(size);
  const container = new Uint8Array(size);

  let parent: Int32Array;
  if (parentIdx && parentIdx.length === size) {
    parent = parentIdx;
  } else {
    parent = new Int32Array(size).fill(-1);
    const byPath = new Map<string, number>();
    for (let i = 0; i < size; i++) byPath.set(nodes[i].path, i);
    for (let i = 0; i < size; i++) {
      const p = nodes[i].parent;
      parent[i] = p === null ? -1 : (byPath.get(p) ?? -1);
    }
  }

  for (let i = 0; i < size; i++) {
    const n = nodes[i];
    keys[i] = n.key;
    if (n.isContainer) {
      container[i] = 1;
      vals[i] = "";
    } else {
      vals[i] = n.value === null ? "null" : String(n.value);
    }
  }

  return { size, keys, keysLower: null, vals, valsLower: null, parent, container };
}

function lowerAll(src: string[]): string[] {
  const out = new Array<string>(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i].toLowerCase();
  return out;
}

/** Build the lowercase columns on demand (main-thread fallback path only). */
export function ensureLower(index: SearchIndex) {
  if (!index.keysLower) index.keysLower = lowerAll(index.keys);
  if (!index.valsLower) index.valsLower = lowerAll(index.vals);
}



export interface ScanOptions {
  scope: SearchScope;
  caseSensitive: boolean;
  regex: boolean;
}

export interface ScanResult {
  indices: Int32Array;
  truncated: boolean;
}

/**
 * Scan the index for `query`. When `subset` is supplied only those node indices
 * are re-tested — used for incremental narrowing as the user keeps typing.
 */
export function scanIndex(
  index: SearchIndex,
  query: string,
  opts: ScanOptions,
  subset?: Int32Array,
): ScanResult {
  const out: number[] = [];
  const wantKeys = opts.scope !== "values";
  const wantVals = opts.scope !== "keys";
  const total = subset ? subset.length : index.size;

  if (opts.regex) {
    const re = new RegExp(query, opts.caseSensitive ? "" : "i");
    for (let p = 0; p < total && out.length < MAX_HITS; p++) {
      const i = subset ? subset[p] : p;
      if (wantKeys && re.test(index.keys[i])) {
        out.push(i);
        continue;
      }
      if (wantVals && index.container[i] === 0 && re.test(index.vals[i])) out.push(i);
    }
    return { indices: Int32Array.from(out), truncated: out.length >= MAX_HITS };
  }

  if (!opts.caseSensitive) ensureLower(index);
  const keys = opts.caseSensitive ? index.keys : index.keysLower!;
  const vals = opts.caseSensitive ? index.vals : index.valsLower!;
  const needle = opts.caseSensitive ? query : query.toLowerCase();

  for (let p = 0; p < total && out.length < MAX_HITS; p++) {
    const i = subset ? subset[p] : p;
    if (wantKeys && keys[i].indexOf(needle) !== -1) {
      out.push(i);
      continue;
    }
    if (wantVals && index.container[i] === 0 && vals[i].indexOf(needle) !== -1) out.push(i);
  }
  return { indices: Int32Array.from(out), truncated: out.length >= MAX_HITS };
}

/** Mark every ancestor of every hit as expanded. Stops early on shared chains. */
export function expandAncestors(index: SearchIndex, hits: Int32Array, mask: Uint8Array): boolean {
  let changed = false;
  for (let h = 0; h < hits.length; h++) {
    let p = index.parent[hits[h]];
    while (p !== -1) {
      if (mask[p] === 1) break;
      mask[p] = 1;
      changed = true;
      p = index.parent[p];
    }
  }
  return changed;
}
