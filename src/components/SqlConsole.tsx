import { useEffect, useState } from "react";
import { DatabaseIcon } from "@/components/icons";
import { LightningZap } from "@/components/LightningZap";
import { loadJson, runQuery, type QueryResult } from "@/lib/duckdb";
import type { JsonValue } from "@/lib/types";

type Status = "idle" | "booting" | "ready" | "failed";

export function SqlConsole({ doc }: { doc: JsonValue | null }) {
  const [status, setStatus] = useState<Status>("idle");
  const [info, setInfo] = useState<string | null>(null);
  const [sql, setSql] = useState("SELECT * FROM data LIMIT 20");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Re-register the document whenever it changes while the engine is up.
  useEffect(() => {
    if (status !== "ready" || !doc) return;
    loadJson(doc)
      .then(({ rows }) => setInfo(`data · ${rows} rows`))
      .catch((e: Error) => setError(e.message));
  }, [doc, status]);

  const boot = async () => {
    if (!doc) return;
    setStatus("booting");
    setError(null);
    try {
      const { rows } = await loadJson(doc);
      setInfo(`data · ${rows} rows`);
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
    }
  };

  const execute = async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await runQuery(sql));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center font-mono text-[13px] text-muted-foreground">
        Load a document first — the SQL engine queries whatever you have open.
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <DatabaseIcon className="h-6 w-6 text-brass" />
        <p className="max-w-sm font-mono text-[12px] text-muted-foreground">
          SIFT registers your JSON as a table called <span className="text-t-string">data</span> in
          an in-browser DuckDB engine. Nothing is uploaded.
        </p>
        <button
          type="button"
          onClick={boot}
          disabled={status === "booting"}
          className="border border-brass bg-brass px-3 py-1.5 font-mono text-[11px] text-background transition-colors hover:bg-transparent hover:text-brass disabled:opacity-50"
        >
          {status === "booting" ? "starting engine…" : "start sql engine"}
        </button>
        {error && <p className="font-mono text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="eyebrow">{info ?? "engine ready"}</span>
        <div className="flex items-center gap-2">
          <LightningZap ms={result?.ms ?? null} />
          <button
            type="button"
            onClick={execute}
            disabled={running}
            className="border border-brass bg-brass px-3 py-1 font-mono text-[11px] text-background transition-colors hover:bg-transparent hover:text-brass disabled:opacity-50"
          >
            {running ? "running…" : "run"}
          </button>
        </div>
      </div>

      <textarea
        value={sql}
        spellCheck={false}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void execute();
          }
        }}
        aria-label="SQL query"
        className="h-28 w-full shrink-0 resize-none border-b border-border bg-background p-3 font-mono text-[12px] leading-relaxed text-t-string focus:outline-none"
      />

      {error && (
        <p role="alert" className="border-b border-border px-3 py-2 font-mono text-[11px] text-destructive">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {result && (
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead className="sticky top-0 z-10 bg-panel-raised">
              <tr>
                {result.columns.map((c) => (
                  <th
                    key={c}
                    className="border-b border-border-strong px-2 py-1.5 text-left font-normal tracking-wide whitespace-nowrap text-brass"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="hover:bg-panel-raised/60">
                  {row.map((cell, j) => (
                    <td key={j} className="border-b border-border px-2 py-1 align-top whitespace-nowrap">
                      <Cell value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {result && result.rows.length === 0 && (
          <p className="px-3 py-3 font-mono text-[11px] text-t-null">Query returned no rows.</p>
        )}
      </div>
    </div>
  );
}

function Cell({ value }: { value: unknown }) {
  if (value === null) return <span className="text-t-null italic">null</span>;
  if (typeof value === "number") return <span className="text-t-number tabular-nums">{value}</span>;
  if (typeof value === "boolean") return <span className="text-t-boolean">{String(value)}</span>;
  if (typeof value === "object")
    return <span className="text-muted-foreground">{JSON.stringify(value)}</span>;
  return <span className="text-t-string">{String(value)}</span>;
}
