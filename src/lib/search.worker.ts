/// <reference lib="webworker" />
/**
 * Search worker.
 *
 * Owns the heavy string columns (keys / values plus their lowercased twins) and
 * every scan over them, so typing never touches the main thread's frame budget.
 */
import type { SearchScope } from "./types";

const MAX_HITS = 50_000;

interface ScanOpts {
  scope: SearchScope;
  caseSensitive: boolean;
  regex: boolean;
}

type InitMsg = { type: "init"; docId: number; keys: string[]; vals: string[]; container: Uint8Array };
type ScanMsg = { type: "scan"; docId: number; id: number; query: string; opts: ScanOpts };
type ResetMsg = { type: "reset" };
type InMsg = InitMsg | ScanMsg | ResetMsg;

let docId = -1;
let keys: string[] = [];
let vals: string[] = [];
let keysLower: string[] = [];
let valsLower: string[] = [];
let container = new Uint8Array(0);

// forward-typing cache: narrowing a substring scan only re-tests prior hits
let cache: { query: string; key: string; hits: Int32Array; truncated: boolean } | null = null;

function lowerAll(src: string[]): string[] {
  const out = new Array<string>(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i].toLowerCase();
  return out;
}

function scan(query: string, opts: ScanOpts, subset?: Int32Array) {
  const out: number[] = [];
  const wantKeys = opts.scope !== "values";
  const wantVals = opts.scope !== "keys";
  const total = subset ? subset.length : keys.length;

  if (opts.regex) {
    const re = new RegExp(query, opts.caseSensitive ? "" : "i");
    for (let p = 0; p < total && out.length < MAX_HITS; p++) {
      const i = subset ? subset[p] : p;
      if (wantKeys && re.test(keys[i])) {
        out.push(i);
        continue;
      }
      if (wantVals && container[i] === 0 && re.test(vals[i])) out.push(i);
    }
    return { indices: Int32Array.from(out), truncated: out.length >= MAX_HITS };
  }

  const k = opts.caseSensitive ? keys : keysLower;
  const v = opts.caseSensitive ? vals : valsLower;
  const needle = opts.caseSensitive ? query : query.toLowerCase();

  for (let p = 0; p < total && out.length < MAX_HITS; p++) {
    const i = subset ? subset[p] : p;
    if (wantKeys && k[i].indexOf(needle) !== -1) {
      out.push(i);
      continue;
    }
    if (wantVals && container[i] === 0 && v[i].indexOf(needle) !== -1) out.push(i);
  }
  return { indices: Int32Array.from(out), truncated: out.length >= MAX_HITS };
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;

  if (msg.type === "reset") {
    docId = -1;
    keys = [];
    vals = [];
    keysLower = [];
    valsLower = [];
    container = new Uint8Array(0);
    cache = null;
    return;
  }

  if (msg.type === "init") {
    docId = msg.docId;
    keys = msg.keys;
    vals = msg.vals;
    container = new Uint8Array(msg.container as unknown as ArrayLike<number>);
    keysLower = lowerAll(keys);
    valsLower = lowerAll(vals);
    cache = null;
    (self as unknown as Worker).postMessage({ type: "ready", docId });
    return;
  }

  if (msg.type === "scan") {
    if (msg.docId !== docId) {
      (self as unknown as Worker).postMessage({ type: "stale", id: msg.id });
      return;
    }
    const cacheKey = `${msg.opts.scope}|${msg.opts.caseSensitive}|${msg.opts.regex}`;
    let result: { indices: Int32Array; truncated: boolean };
    let error: string | null = null;
    try {
      const canNarrow =
        !msg.opts.regex &&
        cache !== null &&
        cache.key === cacheKey &&
        !cache.truncated &&
        msg.query.length > cache.query.length &&
        msg.query.startsWith(cache.query);
      result = scan(msg.query, msg.opts, canNarrow && cache ? cache.hits : undefined);
      cache = { query: msg.query, key: cacheKey, hits: result.indices, truncated: result.truncated };
    } catch (err) {
      cache = null;
      result = { indices: new Int32Array(0), truncated: false };
      error = (err as Error).message;
    }
    const buf = result.indices.buffer as ArrayBuffer;
    (self as unknown as Worker).postMessage(
      { type: "result", id: msg.id, docId, hits: result.indices, truncated: result.truncated, error },
      [buf],
    );
  }
};
