import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Statement from "effect/sql/Statement";

import { Criteria } from "@/globals/application/ddd/specification.js";

// Maps a spec's logical field names to physical columns. Values may be
// qualified (e.g. "m.role") so the fragment slots into a repository query that
// owns its own FROM/JOINs — the compiler emits ONLY the WHERE, never the table
// or projection. The map lives with each repository's mapper.
export type ColumnMap = Readonly<Record<string, string>>;

export class UnmappedCriteriaField extends Schema.TaggedError<
  UnmappedCriteriaField,
  { readonly brand: "UnmappedCriteriaField" }
>()("UnmappedCriteriaField", { field: Schema.String }) {}

// Compiles a Criteria (root-level scalar predicate) into a WHERE fragment. The
// repository interpolates the result into a query it wrote:
//   SELECT <projection> FROM <tables/joins> WHERE ${where}
// A field with no column mapping is a programmer error (die), not a query.
export const criteriaToWhere = (
  sql: Statement.Constructor,
  criteria: Criteria,
  columns: ColumnMap,
): Effect.Effect<Statement.Fragment> => {
  const column = (field: string) =>
    Option.match(Option.fromUndefinedOr(columns[field]), {
      onNone: () => Effect.die(new UnmappedCriteriaField({ field })),
      onSome: (mapped) => Effect.succeed(sql(mapped)),
    });

  const compile = (node: Criteria): Effect.Effect<Statement.Fragment> =>
    Criteria.$match(node, {
      And: ({ nodes }) => {
        if (nodes.length === 0) return Effect.succeed(sql`TRUE`);

        return Effect.map(Effect.forEach(nodes, compile), Statement.and);
      },
      // `Statement.or` folds an empty list to `1=1`; an empty disjunction is
      // FALSE, and delegating here would silently invert the predicate.
      Or: ({ nodes }) => {
        if (nodes.length === 0) return Effect.succeed(sql`FALSE`);

        return Effect.map(Effect.forEach(nodes, compile), Statement.or);
      },
      Not: ({ node: inner }) => Effect.map(compile(inner), (fragment) => sql`(NOT ${fragment})`),
      IsNull: ({ field }) => Effect.map(column(field), (name) => sql`${name} IS NULL`),
      IsNotNull: ({ field }) => Effect.map(column(field), (name) => sql`${name} IS NOT NULL`),
      Eq: ({ field, value }) => Effect.map(column(field), (name) => sql`${name} = ${value}`),
    });

  return compile(criteria);
};
