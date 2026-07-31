export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type NodeKind = "object" | "array" | "string" | "number" | "boolean" | "null";

export interface TreeNode {
  /** JSON path, e.g. $.users[0].name — also used as the row id */
  path: string;
  parent: string | null;
  key: string;
  depth: number;
  kind: NodeKind;
  /** primitive value, or undefined for containers */
  value?: string | number | boolean | null;
  childCount: number;
  isContainer: boolean;
  /** index of last descendant in the flat node list (exclusive) */
  end: number;
}

export interface JsonStats {
  nodes: number;
  leaves: number;
  containers: number;
  depth: number;
  bytes: number;
}

export type SearchScope = "keys" | "values" | "both";

export interface SearchOptions {
  query: string;
  scope: SearchScope;
  caseSensitive: boolean;
  regex: boolean;
}

export interface Range {
  start: number;
  end: number;
}

export interface MatchHit {
  path: string;
  keyRanges: Range[];
  valueRanges: Range[];
}

export interface SearchResult {
  hits: MatchHit[];
  ms: number;
  error: string | null;
  /** SQL-ish translation shown to the user when a Mongo-style query is used */
  translated: string | null;
}
