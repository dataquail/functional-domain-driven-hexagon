import * as Statement from "effect/unstable/sql/Statement";

import { type Criteria } from "@/platform/ddd/contracts/specification.js";

// Maps a spec's logical field names to physical columns. Values may be
// qualified (e.g. "m.role") so the fragment slots into a repository query that
// owns its own FROM/JOINs — the compiler emits ONLY the WHERE, never the table
// or projection. The map lives with each repository's mapper.
export type ColumnMap = Readonly<Record<string, string>>;

// Compiles a Criteria (root-level scalar predicate) into a WHERE fragment. The
// repository interpolates the result into a query it wrote:
//   SELECT <projection> FROM <tables/joins> WHERE ${criteriaToWhere(sql, ...)}
// A field with no column mapping is a programmer error (die), not a query.
export const criteriaToWhere = (
  sql: Statement.Constructor,
  criteria: Criteria,
  columns: ColumnMap,
): Statement.Fragment => {
  const column = (field: string) => {
    const mapped = columns[field];
    if (mapped === undefined) {
      throw new Error(`criteriaToWhere: no column mapping for field "${field}"`);
    }
    return sql(mapped);
  };

  const compile = (node: Criteria): Statement.Fragment => {
    if (node._tag === "And") {
      return node.nodes.length === 0 ? sql`TRUE` : Statement.and(node.nodes.map(compile));
    }
    // `Statement.or` folds an empty list to `1=1`; an empty disjunction is
    // FALSE, and delegating here would silently invert the predicate.
    if (node._tag === "Or") {
      return node.nodes.length === 0 ? sql`FALSE` : Statement.or(node.nodes.map(compile));
    }
    if (node._tag === "Not") return sql`(NOT ${compile(node.node)})`;
    if (node._tag === "IsNull") return sql`${column(node.field)} IS NULL`;
    if (node._tag === "IsNotNull") return sql`${column(node.field)} IS NOT NULL`;
    // Eq — the exhaustive final branch.
    return sql`${column(node.field)} = ${node.value}`;
  };

  return compile(criteria);
};
