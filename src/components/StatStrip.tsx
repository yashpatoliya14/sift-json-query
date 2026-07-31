import { formatBytes } from "@/lib/jsonTools";
import type { JsonStats } from "@/lib/types";

export function StatStrip({ stats }: { stats: JsonStats }) {
  const cells: Array<[string, string]> = [
    ["nodes", stats.nodes.toLocaleString()],
    ["leaves", stats.leaves.toLocaleString()],
    ["containers", stats.containers.toLocaleString()],
    ["max depth", String(stats.depth)],
    ["size", formatBytes(stats.bytes)],
  ];

  return (
    <dl className="grid grid-cols-5 border-y border-border bg-panel">
      {cells.map(([label, value], i) => (
        <div
          key={label}
          className={`px-3 py-2 ${i > 0 ? "border-l border-border" : ""}`}
        >
          <dt className="eyebrow leading-none">{label}</dt>
          <dd className="mt-1 font-mono text-[13px] leading-none tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
