import type { JsonValue } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

let dbPromise: Promise<any> | null = null;

async function createDb(): Promise<any> {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }),
  );
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  return db;
}

export function getDb(): Promise<any> {
  if (!dbPromise) dbPromise = createDb();
  return dbPromise;
}

/** Pick the most table-like array in the document so `data` is useful out of the box. */
function bestTable(root: JsonValue): JsonValue[] | null {
  let best: JsonValue[] | null = null;
  const visit = (v: JsonValue) => {
    if (Array.isArray(v)) {
      const objects = v.filter((i) => i !== null && typeof i === "object" && !Array.isArray(i));
      if (objects.length && (!best || objects.length > best.length)) best = v;
      v.forEach(visit);
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(visit);
    }
  };
  visit(root);
  return best;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  ms: number;
}

export async function loadJson(root: JsonValue): Promise<{ table: string; rows: number }> {
  const db = await getDb();
  const table = bestTable(root) ?? [root];
  const ndjson = table.map((r) => JSON.stringify(r)).join("\n");
  await db.registerFileText("sift.json", ndjson);
  const conn = await db.connect();
  try {
    await conn.query(`DROP TABLE IF EXISTS data`);
    await conn.query(
      `CREATE TABLE data AS SELECT * FROM read_json_auto('sift.json', format='newline_delimited')`,
    );
    const count = await conn.query(`SELECT count(*)::INT AS n FROM data`);
    return { table: "data", rows: Number(count.toArray()[0].n) };
  } finally {
    await conn.close();
  }
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object") return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
  return value;
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const db = await getDb();
  const conn = await db.connect();
  const started = performance.now();
  try {
    const result = await conn.query(sql);
    const columns: string[] = result.schema.fields.map((f: any) => f.name as string);
    const rows = result.toArray().map((r: any) => {
      const obj = r.toJSON();
      return columns.map((c) => normalize(obj[c]));
    });
    return { columns, rows, ms: performance.now() - started };
  } finally {
    await conn.close();
  }
}
