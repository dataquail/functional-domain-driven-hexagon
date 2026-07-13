import { sql } from "@org/database/index";

import { type Criteria } from "@/platform/ddd/contracts/specification.js";

type WhereFragment = ReturnType<typeof sql.fragment>;

// Maps a spec's logical field names to physical columns. Values may be
// qualified (e.g. "m.role") so the fragment slots into a repository query that
// owns its own FROM/JOINs — the compiler emits ONLY the WHERE, never the table
// or projection. The map lives with each repository's mapper.
export type ColumnMap = Readonly<Record<string, string>>;

// Compiles a Criteria (root-level scalar predicate) into a slonik WHERE
// fragment. The repository interpolates the result into a query it wrote:
//   SELECT <projection> FROM <tables/joins> WHERE ${criteriaToWhere(...)}
// A field with no column mapping is a programmer error (die), not a query.
export const criteriaToWhere = (criteria: Criteria, columns: ColumnMap): WhereFragment => {
  const column = (field: string) => {
    const mapped = columns[field];
    if (mapped === undefined) {
      throw new Error(`criteriaToWhere: no column mapping for field "${field}"`);
    }
    return sql.identifier([mapped]);
  };

  const compile = (node: Criteria): WhereFragment => {
    if (node._tag === "And") {
      return node.nodes.length === 0
        ? sql.fragment`TRUE`
        : sql.fragment`(${sql.join(node.nodes.map(compile), sql.fragment` AND `)})`;
    }
    if (node._tag === "Or") {
      return node.nodes.length === 0
        ? sql.fragment`FALSE`
        : sql.fragment`(${sql.join(node.nodes.map(compile), sql.fragment` OR `)})`;
    }
    if (node._tag === "Not") return sql.fragment`(NOT ${compile(node.node)})`;
    if (node._tag === "IsNull") return sql.fragment`${column(node.field)} IS NULL`;
    if (node._tag === "IsNotNull") return sql.fragment`${column(node.field)} IS NOT NULL`;
    // Eq — the exhaustive final branch.
    return sql.fragment`${column(node.field)} = ${node.value}`;
  };

  return compile(criteria);
};
