import { deepStrictEqual, throws } from "node:assert";

import { PgClient } from "@effect/sql-pg";
import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Statement from "effect/unstable/sql/Statement";

import { Spec } from "@/platform/ddd/contracts/specification.js";

import { type ColumnMap, criteriaToWhere } from "./criteria-to-sql.js";

type Row = { id: string; acceptedAt: string | null; revokedAt: string | null };

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
  undefined,
);

const compile = (fragment: Statement.Fragment) => {
  const [text, params] = compiler.compile(fragment, false);
  return { text, params };
};

describe("criteriaToWhere", () => {
  it("compiles composed null checks to a parameter-free WHERE fragment", () => {
    const isOpen = Spec.not(
      Spec.or(Spec.isNotNull<Row>("acceptedAt"), Spec.isNotNull<Row>("revokedAt")),
    );
    const { params, text } = compile(criteriaToWhere(sql, isOpen.criteria, columns));
    deepStrictEqual(text, '(NOT ("accepted_at" IS NOT NULL OR "revoked_at" IS NOT NULL))');
    deepStrictEqual(params, []);
  });

  it("parameterizes Eq values (no interpolation into SQL text)", () => {
    const { params, text } = compile(
      criteriaToWhere(sql, Spec.eq<Row, "id">("id", "abc").criteria, columns),
    );
    deepStrictEqual(text, '"id" = $1');
    deepStrictEqual(params, ["abc"]);
  });

  it("combines key eq + variant into one AND fragment", () => {
    const spec = Spec.and(Spec.eq<Row, "id">("id", "abc"), Spec.isNull<Row>("acceptedAt"));
    const { params, text } = compile(criteriaToWhere(sql, spec.criteria, columns));
    deepStrictEqual(text, '("id" = $1 AND "accepted_at" IS NULL)');
    deepStrictEqual(params, ["abc"]);
  });

  it("compiles an empty conjunction to TRUE and an empty disjunction to FALSE", () => {
    deepStrictEqual(compile(criteriaToWhere(sql, Spec.and<Row>().criteria, columns)).text, "TRUE");
    deepStrictEqual(compile(criteriaToWhere(sql, Spec.or<Row>().criteria, columns)).text, "FALSE");
  });

  it("dies on an unmapped field (programmer error, not a query)", () => {
    const spec = Spec.eq<Row, "id">("id", "abc");
    throws(() => criteriaToWhere(sql, spec.criteria, { acceptedAt: "accepted_at" }));
  });
});
