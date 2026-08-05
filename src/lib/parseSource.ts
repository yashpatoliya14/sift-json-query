import { XMLParser } from "fast-xml-parser";
import { parse as parseYaml } from "yaml";
import { parse as parseToml } from "smol-toml";

import type { JsonValue } from "./types";

export type SourceFormat = "json" | "ndjson" | "xml" | "yaml" | "toml" | "csv" | "tsv";

export const FORMAT_LABEL: Record<SourceFormat, string> = {
  json: "JSON",
  ndjson: "NDJSON",
  xml: "XML",
  yaml: "YAML",
  toml: "TOML",
  csv: "CSV",
  tsv: "TSV",
};

export const ACCEPTED_EXTENSIONS =
  ".json,.jsonl,.ndjson,.xml,.svg,.rss,.atom,.plist,.yaml,.yml,.toml,.csv,.tsv,.txt,application/json,text/plain";

const BY_EXTENSION: Record<string, SourceFormat> = {
  json: "json",
  jsonl: "ndjson",
  ndjson: "ndjson",
  xml: "xml",
  svg: "xml",
  rss: "xml",
  atom: "xml",
  xsd: "xml",
  plist: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  csv: "csv",
  tsv: "tsv",
};

export function formatFromFileName(name: string): SourceFormat | null {
  const ext = name.split(".").pop()?.toLowerCase();
  return (ext && BY_EXTENSION[ext]) || null;
}

/** Content sniffing for pasted text (or files with a generic extension). */
export function detectFormat(raw: string): SourceFormat {
  const text = raw.trimStart();
  const head = text.slice(0, 4096);

  if (head.startsWith("<?xml") || head.startsWith("<!DOCTYPE") || /^<[A-Za-z_]/.test(head)) return "xml";

  if (head.startsWith("{") || head.startsWith("[")) {
    // Several top-level objects separated by newlines => NDJSON.
    if (/^\s*\{[\s\S]*?\}\s*\n\s*\{/.test(head)) return "ndjson";
    return "json";
  }

  const lines = head.split("\n").filter((l) => l.trim() && !l.trimStart().startsWith("#"));
  if (lines.length > 0) {
    if (/^\s*\[[^\]]+\]\s*$/.test(lines[0]) || /^\s*[A-Za-z0-9_.-]+\s*=\s*/.test(lines[0])) return "toml";
  }

  const firstLine = lines[0] ?? "";
  if (firstLine.includes("\t")) return "tsv";
  if (lines.length > 1) {
    const commas = (firstLine.match(/,/g) ?? []).length;
    const second = (lines[1].match(/,/g) ?? []).length;
    if (commas > 0 && commas === second) return "csv";
  }

  return "yaml";
}

/** RFC 4180-ish delimited parser: quoted fields, escaped quotes, CRLF. */
function parseDelimited(raw: string, delimiter: string): JsonValue {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quoted) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.length > 1 || r[0] !== "");
  if (nonEmpty.length === 0) return [];

  const header = nonEmpty[0].map((h, i) => h.trim() || `column_${i + 1}`);
  const out: JsonValue[] = [];
  for (let r = 1; r < nonEmpty.length; r++) {
    const rec: Record<string, JsonValue> = {};
    for (let c = 0; c < header.length; c++) rec[header[c]] = coerceScalar(nonEmpty[r][c] ?? "");
    out.push(rec);
  }
  return out;
}

/** Delimited and XML formats are string-only on the wire — recover real types. */
function coerceScalar(v: string): JsonValue {
  const t = v.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n) && String(n) === t) return n;
  }
  return v;
}

function parseNdjson(raw: string): JsonValue {
  const out: JsonValue[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as JsonValue);
    } catch (e) {
      throw new Error(`line ${i + 1}: ${(e as Error).message}`);
    }
  }
  return out;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseAttributeValue: true,
  trimValues: true,
});

export interface ParseResult {
  value: JsonValue;
  format: SourceFormat;
}

/**
 * Parse any supported interchange format into a plain JSON value that the tree,
 * search index and DuckDB layers can all consume unchanged.
 */
export function parseSource(raw: string, hint?: SourceFormat | null): ParseResult {
  const format = hint ?? detectFormat(raw);
  try {
    switch (format) {
      case "json":
        return { value: JSON.parse(raw) as JsonValue, format };
      case "ndjson":
        return { value: parseNdjson(raw), format };
      case "xml":
        return { value: xmlParser.parse(raw) as JsonValue, format };
      case "yaml":
        return { value: (parseYaml(raw) ?? null) as JsonValue, format };
      case "toml":
        return { value: parseToml(raw) as JsonValue, format };
      case "csv":
        return { value: parseDelimited(raw, ","), format };
      case "tsv":
        return { value: parseDelimited(raw, "\t"), format };
    }
  } catch (e) {
    throw new Error(`Invalid ${FORMAT_LABEL[format]} — ${(e as Error).message}`);
  }
}
