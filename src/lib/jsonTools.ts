import type { Range, TreeNode } from "./types";

export function displayValue(node: TreeNode): string {
  if (node.isContainer) return node.kind === "array" ? "[…]" : "{…}";
  if (node.kind === "string") return String(node.value);
  return String(node.value);
}

export function rawText(node: TreeNode): string {
  if (node.isContainer) return "";
  return node.value === null ? "null" : String(node.value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function compactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** All match ranges of `query` inside `text`. Returns [] when nothing matches. */
export function findRanges(
  text: string,
  query: string,
  opts: { caseSensitive: boolean; regex: boolean },
): Range[] {
  if (!text || !query) return [];
  const ranges: Range[] = [];
  if (opts.regex) {
    const re = new RegExp(query, opts.caseSensitive ? "g" : "gi");
    let guard = 0;
    for (let m = re.exec(text); m !== null && guard < 500; m = re.exec(text)) {
      guard++;
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
    return ranges;
  }
  const haystack = opts.caseSensitive ? text : text.toLowerCase();
  const needle = opts.caseSensitive ? query : query.toLowerCase();
  let from = 0;
  for (let i = haystack.indexOf(needle, from); i !== -1; i = haystack.indexOf(needle, from)) {
    ranges.push({ start: i, end: i + needle.length });
    from = i + needle.length;
  }
  return ranges;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
