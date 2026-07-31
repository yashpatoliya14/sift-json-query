import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ListImperativeAPI } from "react-window";

import { Header } from "@/components/Header";
import { MatchLedger, type LedgerItem } from "@/components/MatchLedger";
import { SearchControls } from "@/components/SearchControls";
import { SourceControls } from "@/components/SourceControls";
import { SqlConsole } from "@/components/SqlConsole";
import { StatStrip } from "@/components/StatStrip";
import { TreePanel } from "@/components/TreePanel";
import { DatabaseIcon, TreeIcon } from "@/components/icons";
import { buildNodes, computeStats, visibleRows } from "@/lib/flattenTree";
import { copyText, rawText } from "@/lib/jsonTools";
import { looksLikeMongo, parseMongo, runMongo, toSqlWhere } from "@/lib/mongoSearch";
import { SAMPLE_JSON } from "@/lib/sampleData";
import { buildSearchIndex, expandAncestors, scanIndex } from "@/lib/searchIndex";
import type { ScanOptions, SearchIndex } from "@/lib/searchIndex";
import { cn } from "@/lib/utils";
import type { MatchQuery } from "@/components/VirtualRow";
import type { JsonValue, SearchResult, SearchScope, TreeNode } from "@/lib/types";

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

const NO_HITS = new Int32Array(0);
const LEDGER_WINDOW = 200;
const EMPTY: SearchResult = {
  hits: NO_HITS,
  truncated: false,
  ms: 0,
  error: null,
  translated: null,
};

interface ScanCache {
  query: string;
  key: string;
  hits: Int32Array;
  truncated: boolean;
}

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

  const [expanded, setExpanded] = useState<Uint8Array>(() => new Uint8Array(0));
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [tab, setTab] = useState<"tree" | "sql">("tree");

  const listRef = useRef<ListImperativeAPI>(null);
  const cacheRef = useRef<ScanCache | null>(null);

  const nodes = useMemo(() => (doc === null ? [] : buildNodes(doc)), [doc]);
  const index = useMemo(() => buildSearchIndex(nodes), [nodes]);
  const stats = useMemo(() => computeStats(nodes, bytes), [nodes, bytes]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 120);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    cacheRef.current = null;
  }, [index]);

  const search = useMemo<SearchResult>(
    () => runSearch(index, nodes, debounced, { scope, caseSensitive, regex }, cacheRef),
    [index, nodes, debounced, scope, caseSensitive, regex],
  );

  const matched = useMemo(() => {
    const mask = new Uint8Array(index.size);
    for (let i = 0; i < search.hits.length; i++) mask[search.hits[i]] = 1;
    return mask;
  }, [search.hits, index.size]);

  const activeNode = activeIndex < search.hits.length ? search.hits[activeIndex] : -1;

  const matchQuery = useMemo<MatchQuery | null>(
    () => (debounced.trim() ? { query: debounced, scope, caseSensitive, regex } : null),
    [debounced, scope, caseSensitive, regex],
  );

  // Reveal every match: ancestors of hits are expanded automatically.
  useEffect(() => {
    if (search.hits.length === 0) return;
    setExpanded((prev) => {
      const next = new Uint8Array(prev);
      return expandAncestors(index, search.hits, next) ? next : prev;
    });
    setActiveIndex((i) => (i < search.hits.length ? i : 0));
  }, [search.hits, index]);

  const rows = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded]);

  // Only a small window of hits is ever handed to the ledger.
  const ledgerItems = useMemo<LedgerItem[]>(() => {
    const total = search.hits.length;
    if (total === 0) return [];
    const from = Math.max(0, Math.min(activeIndex - 40, total - LEDGER_WINDOW));
    const to = Math.min(total, from + LEDGER_WINDOW);
    const out: LedgerItem[] = [];
    for (let i = from; i < to; i++) {
      const node = nodes[search.hits[i]];
      if (!node) continue;
      out.push({
        index: i,
        path: node.path,
        key: node.key,
        preview: node.isContainer ? `${node.childCount} children` : rawText(node),
      });
    }
    return out;
  }, [search.hits, activeIndex, nodes]);

  // Keep the active match in view.
  useEffect(() => {
    if (activeNode < 0 || tab !== "tree") return;
    const target = nodes[activeNode];
    if (!target) return;
    const at = rows.findIndex((r) => r.i === target.i);
    if (at >= 0) listRef.current?.scrollToRow({ index: at, align: "smart", behavior: "auto" });
  }, [activeNode, rows, tab, nodes]);

  const apply = useCallback((raw: string) => {
    if (!raw.trim()) {
      setParseError("Nothing to parse yet.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as JsonValue;
      const built = buildNodes(parsed);
      setDoc(parsed);
      setBytes(new Blob([raw]).size);
      setParseError(null);
      const mask = new Uint8Array(built.length);
      for (const n of built) if (n.isContainer && n.depth <= 1) mask[n.i] = 1;
      setExpanded(mask);
      setActiveIndex(0);
    } catch (e) {
      setParseError(`Invalid JSON — ${(e as Error).message}`);
    }
  }, []);

  const toggle = useCallback(
    (nodeIdx: number, deep: boolean) => {
      setExpanded((prev) => {
        const next = new Uint8Array(prev);
        const node = nodes[nodeIdx];
        if (!node) return prev;
        const opening = next[nodeIdx] !== 1;
        if (deep) {
          for (let i = nodeIdx; i < node.end; i++) {
            if (!nodes[i].isContainer) continue;
            next[i] = opening ? 1 : 0;
          }
        } else {
          next[nodeIdx] = opening ? 1 : 0;
        }
        return next;
      });
    },
    [nodes],
  );

  const copyPath = useCallback(async (path: string) => {
    await copyText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath((p) => (p === path ? null : p)), 1200);
  }, []);

  const step = useCallback(
    (delta: number) => {
      const total = search.hits.length;
      if (total === 0) return;
      setActiveIndex((i) => (i + delta + total) % total);
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
    setExpanded(new Uint8Array(0));
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
            items={ledgerItems}
            total={search.hits.length}
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
                  matched={matched}
                  expanded={expanded}
                  activeNode={activeNode}
                  copiedPath={copiedPath}
                  match={matchQuery}
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
  index: SearchIndex,
  nodes: TreeNode[],
  query: string,
  opts: ScanOptions,
  cacheRef: React.MutableRefObject<ScanCache | null>,
): SearchResult {
  if (!query.trim() || nodes.length === 0) {
    cacheRef.current = null;
    return EMPTY;
  }
  const started = performance.now();

  if (looksLikeMongo(query)) {
    try {
      const parsed = parseMongo(query);
      const hits = Int32Array.from(runMongo(nodes, parsed));
      cacheRef.current = null;
      return {
        hits,
        truncated: false,
        ms: performance.now() - started,
        error: null,
        translated: toSqlWhere(parsed),
      };
    } catch (e) {
      return { ...EMPTY, error: (e as Error).message };
    }
  }

  try {
    const key = `${opts.scope}|${opts.caseSensitive}|${opts.regex}`;
    const cache = cacheRef.current;
    // Typing forward only ever narrows a substring search — rescan just the
    // previous hits instead of the whole document.
    const canNarrow =
      !opts.regex &&
      cache !== null &&
      cache.key === key &&
      !cache.truncated &&
      query.length > cache.query.length &&
      query.startsWith(cache.query);

    const { indices, truncated } = scanIndex(
      index,
      query,
      opts,
      canNarrow ? cache!.hits : undefined,
    );
    cacheRef.current = { query, key, hits: indices, truncated };
    return { hits: indices, truncated, ms: performance.now() - started, error: null, translated: null };
  } catch (e) {
    return { ...EMPTY, error: `Invalid pattern — ${(e as Error).message}` };
  }
}
