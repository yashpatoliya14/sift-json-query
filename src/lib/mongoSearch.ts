import type { TreeNode } from "./types";

type Operand = string | number | boolean | null;
type Condition = { op: string; operand: Operand | Operand[] };
export interface MongoQuery {
  field: string;
  conditions: Condition[];
}

const OPS = ["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$regex", "$exists"];

/** True when the raw input looks like a Mongo-style query object. */
export function looksLikeMongo(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.length > 2;
}

export function parseMongo(input: string): MongoQuery[] {
  const parsed = JSON.parse(input) as Record<string, unknown>;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Query must be a JSON object, e.g. { \"age\": { \"$gt\": 20 } }");
  }
  return Object.entries(parsed).map(([field, spec]) => {
    if (spec !== null && typeof spec === "object" && !Array.isArray(spec)) {
      const conditions = Object.entries(spec as Record<string, Operand>).map(([op, operand]) => {
        if (!OPS.includes(op)) throw new Error(`Unsupported operator ${op}`);
        return { op, operand } as Condition;
      });
      return { field, conditions };
    }
    return { field, conditions: [{ op: "$eq", operand: spec as Operand }] };
  });
}

const SQL_OPS: Record<string, string> = {
  $eq: "=",
  $ne: "<>",
  $gt: ">",
  $gte: ">=",
  $lt: "<",
  $lte: "<=",
};

function literal(value: Operand | Operand[]): string {
  if (Array.isArray(value)) return `(${value.map((v) => literal(v)).join(", ")})`;
  if (value === null) return "NULL";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  return String(value);
}

/** Translate a parsed Mongo query into the WHERE clause SIFT runs. */
export function toSqlWhere(queries: MongoQuery[]): string {
  const parts: string[] = [];
  for (const q of queries) {
    for (const c of q.conditions) {
      const col = `"${q.field}"`;
      if (c.op === "$in") parts.push(`${col} IN ${literal(c.operand)}`);
      else if (c.op === "$nin") parts.push(`${col} NOT IN ${literal(c.operand)}`);
      else if (c.op === "$regex") parts.push(`regexp_matches(CAST(${col} AS VARCHAR), ${literal(c.operand)})`);
      else if (c.op === "$exists") parts.push(c.operand === false ? `${col} IS NULL` : `${col} IS NOT NULL`);
      else parts.push(`${col} ${SQL_OPS[c.op]} ${literal(c.operand)}`);
    }
  }
  return `WHERE ${parts.join(" AND ")}`;
}

function compare(value: unknown, c: Condition): boolean {
  const { op, operand } = c;
  switch (op) {
    case "$eq":
      return value === operand;
    case "$ne":
      return value !== operand;
    case "$gt":
      return typeof value === "number" && typeof operand === "number" && value > operand;
    case "$gte":
      return typeof value === "number" && typeof operand === "number" && value >= operand;
    case "$lt":
      return typeof value === "number" && typeof operand === "number" && value < operand;
    case "$lte":
      return typeof value === "number" && typeof operand === "number" && value <= operand;
    case "$in":
      return Array.isArray(operand) && operand.includes(value as Operand);
    case "$nin":
      return Array.isArray(operand) && !operand.includes(value as Operand);
    case "$regex":
      return typeof operand === "string" && new RegExp(operand).test(String(value));
    case "$exists":
      return operand === false ? value === undefined || value === null : value !== undefined && value !== null;
    default:
      return false;
  }
}

/** Indices of nodes whose key matches the field and whose value satisfies every condition. */
export function runMongo(nodes: TreeNode[], queries: MongoQuery[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.isContainer) continue;
    let ok = true;
    for (const q of queries) {
      if (node.key !== q.field || !q.conditions.every((c) => compare(node.value, c))) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}
