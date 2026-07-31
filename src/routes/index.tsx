import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { copyText, rawText } from "@/lib/jsonTools";
import { SAMPLE_JSON } from "@/lib/sampleData";
import {
  activeRowPosition,
  clearDocument,
  getState,
  getVersion,
  loadDocument,
  runSearch,
  setActiveIndex,
  stepActive,
  subscribe,
  toggleNode,
} from "@/lib/docStore";
import { cn } from "@/lib/utils";
import type { MatchQuery, RowData } from "@/components/VirtualRow";
import type { SearchScope } from "@/lib/types";

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

const LEDGER_WINDOW = 200;

function Sift() {
  // Only a version counter crosses into React — bulk data stays in the store.
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);
  const store = getState();

  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("both");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [tab, setTab] = useState<"tree" | "sql">("tree");

  const listRef = useRef<ListImperativeAPI>(null);

  const trimmed = query.trim();

  // Debounced search — the scan itself is a few ms even on 100k nodes.
  useEffect(() => {
    const id = setTimeout(() => runSearch(query, { scope, caseSensitive, regex }), 90);
    return () => clearTimeout(id);
  }, [query, scope, caseSensitive, regex]);

  const matchQuery = useMemo<MatchQuery | null>(
    () => (trimmed ? { query, scope, caseSensitive, regex } : null),
    [trimmed, query, scope, caseSensitive, regex],
  );

  const copyPath = useCallback(async (path: string) => {
    await copyText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath((p) => (p === path ? null : p)), 1200);
  }, []);

  const dataRef = useRef<RowData>({
    rows: [],
    matched: new Uint8Array(0),
    expanded: new Uint8Array(0),
    activeNode: -1,
    copiedPath: null,
    match: null,
    onToggle: toggleNode,
    onCopyPath: copyPath,
  });
  dataRef.current = {
    rows: store.rows,
    matched: store.matched,
    expanded: store.expanded,
    activeNode: store.activeIndex < store.hits.length ? store.hits[store.activeIndex] : -1,
    copiedPath,
    match: matchQuery,
    onToggle: toggleNode,
    onCopyPath: copyPath,
  };
  const readTreeData = useCallback(() => dataRef.current, []);

  // Small, bounded slice of hits for the ledger.
  const ledgerItems = useMemo<LedgerItem[]>(() => {
    const s = getState();
    const total = s.hits.length;
    if (total === 0) return [];
    const from = Math.max(0, Math.min(s.activeIndex - 40, total - LEDGER_WINDOW));
    const to = Math.min(total, from + LEDGER_WINDOW);
    const out: LedgerItem[] = [];
    for (let i = from; i < to; i++) {
      const node = s.nodes[s.hits[i]];
      if (!node) continue;
      out.push({
        index: i,
        path: node.path,
        key: node.key,
        preview: node.isContainer ? `${node.childCount} children` : rawText(node),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Keep the active match in view.
  useEffect(() => {
    if (tab !== "tree") return;
    const at = activeRowPosition();
    if (at >= 0) listRef.current?.scrollToRow({ index: at, align: "smart", behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tab]);

  const loadSample = () => {
    setText(SAMPLE_JSON);
    loadDocument(SAMPLE_JSON);
  };

  const clearAll = () => {
    setText("");
    setQuery("");
    clearDocument();
  };

  const hitCount = store.hits.length;
  const hasDoc = store.doc !== null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header nodeCount={store.stats.nodes} matchCount={hitCount} hasQuery={!!trimmed} />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-border lg:w-[360px] lg:border-r">
          <SourceControls
            text={text}
            onTextChange={setText}
            onApply={loadDocument}
            onClear={clearAll}
            onSample={loadSample}
            error={store.parseError}
          />
          <MatchLedger
            items={ledgerItems}
            total={hitCount}
            activeIndex={store.activeIndex}
            onSelect={setActiveIndex}
            hasQuery={!!trimmed}
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
                matchCount={hitCount}
                activeIndex={store.activeIndex}
                onStep={stepActive}
                ms={store.ms}
                error={store.error}
                translated={store.translated}
              />
              <div className="min-h-0 flex-1">
                <TreePanel listRef={listRef} read={readTreeData} rowCount={store.rows.length} />
              </div>
              <StatStrip stats={store.stats} />
            </>
          ) : (
            <SqlConsole hasDoc={hasDoc} docVersion={version} getDoc={getDocFromStore} />
          )}
        </section>
      </main>
    </div>
  );
}

function getDocFromStore() {
  return getState().doc;
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
