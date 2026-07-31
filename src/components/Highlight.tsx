import type { Range } from "@/lib/types";

interface Props {
  text: string;
  ranges?: Range[];
  activeRange?: number;
  className?: string;
}

/** Renders text with search matches wrapped for highlighting. */
export function Highlight({ text, ranges, activeRange = -1, className }: Props) {
  if (!ranges || ranges.length === 0) return <span className={className}>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, r.start)}</span>);
    parts.push(
      <mark key={`m${i}`} data-active={i === activeRange || undefined} className="sift-mark">
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);

  return <span className={className}>{parts}</span>;
}
