import { deepStrictEqual } from "node:assert";

import { PgClient } from "@effect/sql-pg";
import { describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type * as Option from "effect/Option";
import * as Statement from "effect/sql/Statement";

import { type Criteria, Spec } from "@/globals/application/ddd/specification";

import { type ColumnMap, criteriaToWhere } from "./criteria-to-sql";

type Row = {
  id: string;
  acceptedAt: Option.Option<string>;
  revokedAt: Option.Option<string>;
};

const columns: ColumnMap = {
  id: "id",
  acceptedAt: "accepted_at",
  revokedAt: "revoked_at",
};

// A fragment only becomes SQL text once a dialect compiler renders it, so the
// assertions run the Postgres compiler rather than inspecting segments.
const compiler = PgClient.makeCompiler();

const sql = Statement.make(
  Effect.die(new Error("criteriaToWhere must not execute a statement")),
  compiler,
  [],
  (rows) => rows,
);

const compile = (criteria: Criteria) =>
  Effect.map(criteriaToWhere(sql, criteria, columns), (fragment) => {
    const [text, params] = compiler.compile(fragment, false);

    return { text, params };
  });

describe("criteriaToWhere", () => {
  it.effect("compiles composed null checks to a parameter-free WHERE fragment", () =>
    Effect.gen(function* () {
      const isOpen = Spec.not(
        Spec.or(Spec.isNotNull<Row>("acceptedAt"), Spec.isNotNull<Row>("revokedAt")),
      );

      const { params, text } = yield* compile(isOpen.criteria);
      deepStrictEqual(text, '(NOT ("accepted_at" IS NOT NULL OR "revoked_at" IS NOT NULL))');
      deepStrictEqual(params, []);
    }),
  );

  it.effect("parameterizes Eq values (no interpolation into SQL text)", () =>
    Effect.gen(function* () {
      const { params, text } = yield* compile(Spec.eq<Row, "id">("id", "abc").criteria);

      deepStrictEqual(text, '"id" = $1');
      deepStrictEqual(params, ["abc"]);
    }),
  );

  it.effect("combines key eq + variant into one AND fragment", () =>
    Effect.gen(function* () {
      const spec = Spec.and(Spec.eq<Row, "id">("id", "abc"), Spec.isNull<Row>("acceptedAt"));
      const { params, text } = yield* compile(spec.criteria);
      deepStrictEqual(text, '("id" = $1 AND "accepted_at" IS NULL)');
      deepStrictEqual(params, ["abc"]);
    }),
  );

  it.effect("compiles an empty conjunction to TRUE and an empty disjunction to FALSE", () =>
    Effect.gen(function* () {
      deepStrictEqual((yield* compile(Spec.and<Row>().criteria)).text, "TRUE");
      deepStrictEqual((yield* compile(Spec.or<Row>().criteria)).text, "FALSE");
    }),
  );

  it.effect("dies on an unmapped field (programmer error, not a query)", () =>
    Effect.gen(function* () {
      const spec = Spec.eq<Row, "id">("id", "abc");

      const exit = yield* Effect.exit(
        criteriaToWhere(sql, spec.criteria, { acceptedAt: "accepted_at" }),
      );

      assertTrue(Exit.hasDies(exit));
    }),
  );
});
