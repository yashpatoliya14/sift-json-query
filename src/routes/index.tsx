import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ListImperativeAPI } from "react-window";

import { Header } from "@/components/Header";
import { MatchLedger } from "@/components/MatchLedger";
import { SearchControls } from "@/components/SearchControls";
import { SourceControls } from "@/components/SourceControls";
import { SqlConsole } from "@/components/SqlConsole";
import { StatStrip } from "@/components/StatStrip";
import { TreePanel } from "@/components/TreePanel";
import { DatabaseIcon, TreeIcon } from "@/components/icons";
import { ancestorsOf, buildNodes, computeStats, visibleRows } from "@/lib/flattenTree";
import { copyText, findRanges, rawText } from "@/lib/jsonTools";
import { looksLikeMongo, parseMongo, runMongo, toSqlWhere } from "@/lib/mongoSearch";
import { SAMPLE_JSON } from "@/lib/sampleData";
import { cn } from "@/lib/utils";
import type { JsonValue, MatchHit, SearchResult, SearchScope, TreeNode } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SIFT — JSON Field & Value Explorer" },
      {
        name: "description",
        content:
          "Explore, search and query JSON in your browser: interactive tree, regex and Mongo-style search, and an embedded DuckDB SQL console. Nothing leaves your device.",
      },
      { property: "og:title", content: "SIFT — JSON Field & Value Explorer" },
      {
        property: "og:description",
        content:
          "Paste JSON, browse it as a virtualized tree, search keys and values, and run SQL against it with in-browser DuckDB.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sift,
});

const EMPTY: SearchResult = { hits: [], ms: 0, error: null, translated: null };

function Sift() {
  const [text, setText] = useState("");
  const [doc, setDoc] = useState<JsonValue | null>(null);
  const [bytes, setBytes] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [scope, setScope] = useState<SearchScope>("both");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [tab, setTab] = useState<"tree" | "sql">("tree");

  const listRef = useRef<ListImperativeAPI>(null);

  const nodes = useMemo(() => (doc === null ? [] : buildNodes(doc)), [doc]);
  const nodeIndex = useMemo(() => new Map(nodes.map((n) => [n.path, n])), [nodes]);
  const stats = useMemo(() => computeStats(nodes, bytes), [nodes, bytes]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 140);
    return () => clearTimeout(id);
  }, [query]);

  const search = useMemo<SearchResult>(
    () => runSearch(nodes, debounced, { scope, caseSensitive, regex }),
    [nodes, debounced, scope, caseSensitive, regex],
  );
  const active = search.hits[activeIndex] ?? null;
  const hitMap = useMemo(() => new Map(search.hits.map((h) => [h.path, h])), [search.hits]);

  // Reveal every match: ancestors of hits are expanded automatically.
  useEffect(() => {
    if (search.hits.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const hit of search.hits) {
        for (const a of ancestorsOf(hit.path, nodeIndex)) {
          if (!next.has(a)) {
            next.add(a);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
    setActiveIndex((i) => (i < search.hits.length ? i : 0));
  }, [search.hits, nodeIndex]);

  const rows = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded]);

  // Keep the active match in view.
  useEffect(() => {
    if (!active || tab !== "tree") return;
    const index = rows.findIndex((r) => r.path === active.path);
    if (index >= 0) listRef.current?.scrollToRow({ index, align: "smart", behavior: "auto" });
  }, [active, rows, tab]);

  const apply = useCallback((raw: string) => {
    if (!raw.trim()) {
      setParseError("Nothing to parse yet.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as JsonValue;
      setDoc(parsed);
      setBytes(new Blob([raw]).size);
      setParseError(null);
      const initial = buildNodes(parsed).filter((n) => n.isContainer && n.depth <= 1);
      setExpanded(new Set(initial.map((n) => n.path)));
      setActiveIndex(0);
    } catch (e) {
      setParseError(`Invalid JSON — ${(e as Error).message}`);
    }
  }, []);

  const toggle = useCallback(
    (path: string, deep: boolean) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        const node = nodeIndex.get(path);
        const opening = !next.has(path);
        if (deep && node) {
          const start = nodes.indexOf(node);
          for (let i = start; i < node.end; i++) {
            const child = nodes[i];
            if (!child.isContainer) continue;
            if (opening) next.add(child.path);
            else next.delete(child.path);
          }
        } else if (opening) next.add(path);
        else next.delete(path);
        return next;
      });
    },
    [nodeIndex, nodes],
  );

  const copyPath = useCallback(async (path: string) => {
    await copyText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath((p) => (p === path ? null : p)), 1200);
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (search.hits.length === 0) return;
      setActiveIndex((i) => (i + delta + search.hits.length) % search.hits.length);
    },
    [search.hits.length],
  );

  const loadSample = () => {
    setText(SAMPLE_JSON);
    apply(SAMPLE_JSON);
  };

  const clearAll = () => {
    setText("");
    setDoc(null);
    setBytes(0);
    setParseError(null);
    setQuery("");
    setExpanded(new Set());
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header nodeCount={stats.nodes} matchCount={search.hits.length} hasQuery={!!debounced} />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-border lg:w-[360px] lg:border-r">
          <SourceControls
            text={text}
            onTextChange={setText}
            onApply={apply}
            onClear={clearAll}
            onSample={loadSample}
            error={parseError}
          />
          <MatchLedger
            hits={search.hits}
            nodeIndex={nodeIndex}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            hasQuery={!!debounced}
          />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-stretch border-b border-border bg-panel">
            <Tab active={tab === "tree"} onClick={() => setTab("tree")} icon={<TreeIcon className="h-3.5 w-3.5" />}>
              tree
            </Tab>
            <Tab active={tab === "sql"} onClick={() => setTab("sql")} icon={<DatabaseIcon className="h-3.5 w-3.5" />}>
              sql
            </Tab>
          </div>

          {tab === "tree" ? (
            <>
              <SearchControls
                query={query}
                onQueryChange={setQuery}
                scope={scope}
                onScopeChange={setScope}
                caseSensitive={caseSensitive}
                onCaseToggle={() => setCaseSensitive((v) => !v)}
                regex={regex}
                onRegexToggle={() => setRegex((v) => !v)}
                matchCount={search.hits.length}
                activeIndex={activeIndex}
                onStep={step}
                ms={search.ms}
                error={search.error}
                translated={search.translated}
              />
              <div className="min-h-0 flex-1">
                <TreePanel
                  listRef={listRef}
                  rows={rows}
                  hits={hitMap}
                  expanded={expanded}
                  activePath={active?.path ?? null}
                  copiedPath={copiedPath}
                  onToggle={toggle}
                  onCopyPath={copyPath}
                />
              </div>
              <StatStrip stats={stats} />
            </>
          ) : (
            <SqlConsole doc={doc} />
          )}
        </section>
      </main>
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 border-r border-border px-4 py-2 font-mono text-[11px] tracking-wide transition-colors",
        active
          ? "border-b-2 border-b-brass bg-background text-brass"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function runSearch(
  nodes: TreeNode[],
  query: string,
  opts: { scope: SearchScope; caseSensitive: boolean; regex: boolean },
): SearchResult {
  if (!query.trim() || nodes.length === 0) return EMPTY;
  const started = performance.now();

  if (looksLikeMongo(query)) {
    try {
      const parsed = parseMongo(query);
      const matched = runMongo(nodes, parsed);
      const hits: MatchHit[] = matched.map((n) => ({
        path: n.path,
        keyRanges: [{ start: 0, end: n.key.length }],
        valueRanges: [{ start: 0, end: rawText(n).length }],
      }));
      return {
        hits,
        ms: performance.now() - started,
        error: null,
        translated: toSqlWhere(parsed),
      };
    } catch (e) {
      return { ...EMPTY, error: (e as Error).message };
    }
  }

  try {
    const hits: MatchHit[] = [];
    for (const node of nodes) {
      const keyRanges =
        opts.scope === "values" ? [] : findRanges(node.key, query, opts);
      const valueRanges =
        opts.scope === "keys" || node.isContainer ? [] : findRanges(rawText(node), query, opts);
      if (keyRanges.length || valueRanges.length) hits.push({ path: node.path, keyRanges, valueRanges });
    }
    return { hits, ms: performance.now() - started, error: null, translated: null };
  } catch (e) {
    return { ...EMPTY, error: `Invalid pattern — ${(e as Error).message}` };
  }
}
