import { buildTree, computeStats, visibleRows } from "./flattenTree";
import { looksLikeMongo, parseMongo, runMongo, toSqlWhere } from "./mongoSearch";
import { initWorkerIndex, resetWorkerIndex, scanInWorker, workerAvailable } from "./searchClient";
import { buildSearchIndex, expandAncestors, scanIndex, type ScanOptions, type SearchIndex } from "./searchIndex";
import type { JsonStats, JsonValue, TreeNode } from "./types";


/**
 * All bulk document state lives outside React.
 *
 * Holding 100k-node arrays in component state or props makes every render walk
 * them (React's dev instrumentation serialises props/state), which is what made
 * search feel frozen on large files. Components subscribe to a version counter
 * and pull what they need imperatively.
 */
export interface DocState {
  doc: JsonValue | null;
  nodes: TreeNode[];
  index: SearchIndex;
  stats: JsonStats;
  rows: TreeNode[];
  expanded: Uint8Array;
  hits: Int32Array;
  matched: Uint8Array;
  truncated: boolean;
  activeIndex: number;
  ms: number;
  error: string | null;
  translated: string | null;
  parseError: string | null;
  bytes: number;
  /** Non-null while a document is being ingested. */
  loading: { phase: string; pct: number } | null;
  loadMs: number;

}

const EMPTY_INDEX: SearchIndex = {
  size: 0,
  keys: [],
  keysLower: null,
  vals: [],
  valsLower: null,
  parent: new Int32Array(0),
  container: new Uint8Array(0),
};

const state: DocState = {
  doc: null,
  nodes: [],
  index: EMPTY_INDEX,
  stats: { nodes: 0, leaves: 0, containers: 0, depth: 0, bytes: 0 },
  rows: [],
  expanded: new Uint8Array(0),
  hits: new Int32Array(0),
  matched: new Uint8Array(0),
  truncated: false,
  activeIndex: 0,
  ms: 0,
  error: null,
  translated: null,
  parseError: null,
  bytes: 0,
  loading: null,
  loadMs: 0,
};

let version = 0;
let docVersion = 0;
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion(): number {
  return version;
}

/** Bumps only when the document itself changes (not on search / expand). */
export function getDocVersion(): number {
  return docVersion;
}

export function getState(): DocState {
  return state;
}

function commit() {
  version += 1;
  for (const l of listeners) l();
}

function recomputeRows() {
  state.rows = visibleRows(state.nodes, state.expanded);
}

// ---- search cache: typing forward only narrows a substring scan ------------
let cache: { query: string; key: string; hits: Int32Array; truncated: boolean } | null = null;

/** Yield to the browser so the progress UI can paint between heavy phases. */
const yieldToBrowser = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

let loadToken = 0;

function setPhase(phase: string, pct: number) {
  state.loading = { phase, pct };
  commit();
}

/**
 * Ingest a document in phases, yielding between each so the UI stays live and
 * shows progress. Each phase is a tight, allocation-light pass.
 */
export async function loadDocument(raw: string, sizeHint?: number) {
  if (!raw.trim()) {
    state.parseError = "Nothing to parse yet.";
    state.loading = null;
    commit();
    return;
  }

  const token = ++loadToken;
  const started = performance.now();
  const stale = () => token !== loadToken;

  state.parseError = null;
  setPhase("reading", 5);
  await yieldToBrowser();
  if (stale()) return;

  let parsed: JsonValue;
  try {
    parsed = JSON.parse(raw) as JsonValue;
  } catch (e) {
    if (stale()) return;
    state.parseError = `Invalid JSON — ${(e as Error).message}`;
    state.loading = null;
    commit();
    return;
  }

  // Byte count: exact for modest payloads, cheap estimate for huge ones.
  const bytes = sizeHint ?? (raw.length > 8_000_000 ? raw.length : new Blob([raw]).size);

  setPhase("flattening", 35);
  await yieldToBrowser();
  if (stale()) return;

  const { nodes, parentIdx } = buildTree(parsed);

  setPhase("indexing", 70);
  await yieldToBrowser();
  if (stale()) return;

  const index = buildSearchIndex(nodes, parentIdx);

  setPhase("laying out", 90);
  await yieldToBrowser();
  if (stale()) return;

  const expanded = new Uint8Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.isContainer && n.depth <= 1) expanded[i] = 1;
  }

  state.doc = parsed;
  state.nodes = nodes;
  state.index = index;
  state.bytes = bytes;
  state.stats = computeStats(nodes, bytes);
  state.expanded = expanded;
  state.hits = new Int32Array(0);
  state.matched = new Uint8Array(nodes.length);
  state.truncated = false;
  state.activeIndex = 0;
  state.ms = 0;
  state.error = null;
  state.translated = null;
  state.parseError = null;
  state.loading = null;
  state.loadMs = performance.now() - started;
  cache = null;
  docVersion += 1;
  initWorkerIndex(docVersion, index);
  recomputeRows();
  commit();
}

export function clearDocument() {
  loadToken++;
  state.doc = null;
  state.nodes = [];
  state.index = EMPTY_INDEX;
  state.stats = { nodes: 0, leaves: 0, containers: 0, depth: 0, bytes: 0 };
  state.rows = [];
  state.expanded = new Uint8Array(0);
  state.hits = new Int32Array(0);
  state.matched = new Uint8Array(0);
  state.activeIndex = 0;
  state.ms = 0;
  state.error = null;
  state.translated = null;
  state.parseError = null;
  state.bytes = 0;
  state.loading = null;
  state.loadMs = 0;
  cache = null;
  docVersion += 1;
  commit();
}


function setHits(hits: Int32Array, truncated: boolean) {
  state.hits = hits;
  state.truncated = truncated;
  const matched = new Uint8Array(state.index.size);
  for (let i = 0; i < hits.length; i++) matched[hits[i]] = 1;
  state.matched = matched;
  if (state.activeIndex >= hits.length) state.activeIndex = 0;

  if (hits.length > 0) {
    const next = new Uint8Array(state.expanded);
    if (expandAncestors(state.index, hits, next)) state.expanded = next;
  }
  recomputeRows();
}

export function runSearch(query: string, opts: ScanOptions) {
  if (state.nodes.length === 0) return;
  const started = performance.now();

  if (!query.trim()) {
    cache = null;
    state.error = null;
    state.translated = null;
    state.ms = 0;
    setHits(new Int32Array(0), false);
    commit();
    return;
  }

  if (looksLikeMongo(query)) {
    try {
      const parsed = parseMongo(query);
      const hits = Int32Array.from(runMongo(state.nodes, parsed));
      cache = null;
      state.error = null;
      state.translated = toSqlWhere(parsed);
      setHits(hits, false);
      state.ms = performance.now() - started;
    } catch (e) {
      state.error = (e as Error).message;
      state.translated = null;
      setHits(new Int32Array(0), false);
      state.ms = performance.now() - started;
    }
    commit();
    return;
  }

  try {
    const key = `${opts.scope}|${opts.caseSensitive}|${opts.regex}`;
    const canNarrow =
      !opts.regex &&
      cache !== null &&
      cache.key === key &&
      !cache.truncated &&
      query.length > cache.query.length &&
      query.startsWith(cache.query);

    const { indices, truncated } = scanIndex(
      state.index,
      query,
      opts,
      canNarrow && cache ? cache.hits : undefined,
    );
    cache = { query, key, hits: indices, truncated };
    state.error = null;
    state.translated = null;
    setHits(indices, truncated);
    state.ms = performance.now() - started;
  } catch (e) {
    state.error = `Invalid pattern — ${(e as Error).message}`;
    state.translated = null;
    setHits(new Int32Array(0), false);
    state.ms = performance.now() - started;
  }
  commit();
}

export function toggleNode(nodeIdx: number, deep: boolean) {
  const node = state.nodes[nodeIdx];
  if (!node) return;
  const next = new Uint8Array(state.expanded);
  const opening = next[nodeIdx] !== 1;
  if (deep) {
    for (let i = nodeIdx; i < node.end; i++) {
      if (!state.nodes[i].isContainer) continue;
      next[i] = opening ? 1 : 0;
    }
  } else {
    next[nodeIdx] = opening ? 1 : 0;
  }
  state.expanded = next;
  recomputeRows();
  commit();
}

export function setActiveIndex(i: number) {
  if (state.hits.length === 0) return;
  state.activeIndex = ((i % state.hits.length) + state.hits.length) % state.hits.length;
  commit();
}

export function stepActive(delta: number) {
  setActiveIndex(state.activeIndex + delta);
}

/** Row index of the active hit inside the currently visible rows, or -1. */
export function activeRowPosition(): number {
  const { hits, activeIndex, rows } = state;
  if (activeIndex >= hits.length) return -1;
  const target = hits[activeIndex];
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = rows[mid].i;
    if (v === target) return mid;
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
