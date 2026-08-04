import type { SearchIndex } from "./searchIndex";
import type { ScanOptions } from "./searchIndex";

export interface WorkerScanResult {
  hits: Int32Array;
  truncated: boolean;
  error: string | null;
}

let worker: Worker | null = null;
let supported: boolean | null = null;
let nextId = 1;
const pending = new Map<number, (r: WorkerScanResult | null) => void>();

function ensureWorker(): Worker | null {
  if (supported === false) return null;
  if (worker) return worker;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    supported = false;
    return null;
  }
  try {
    worker = new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg?.type === "result") {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve?.({ hits: msg.hits as Int32Array, truncated: msg.truncated, error: msg.error });
      } else if (msg?.type === "stale") {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve?.(null);
      }
    };
    worker.onerror = () => {
      supported = false;
      for (const [, resolve] of pending) resolve(null);
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    supported = true;
    return worker;
  } catch {
    supported = false;
    return null;
  }
}

/** True when scans can be delegated off the main thread. */
export function workerAvailable(): boolean {
  return ensureWorker() !== null;
}

/** Hand the string columns to the worker; it lowercases them off-thread. */
export function initWorkerIndex(docId: number, index: SearchIndex) {
  const w = ensureWorker();
  if (!w) return;
  const container = new Uint8Array(index.container);
  w.postMessage({ type: "init", docId, keys: index.keys, vals: index.vals, container }, [container.buffer]);
}

export function resetWorkerIndex() {
  const w = ensureWorker();
  w?.postMessage({ type: "reset" });
}

export function scanInWorker(
  docId: number,
  query: string,
  opts: ScanOptions,
): Promise<WorkerScanResult | null> {
  const w = ensureWorker();
  if (!w) return Promise.resolve(null);
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ type: "scan", docId, id, query, opts });
  });
}
