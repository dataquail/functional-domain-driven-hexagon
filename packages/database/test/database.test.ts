import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  ConnectionError,
  ConstraintError,
  SqlError,
  SqlSyntaxError,
  UniqueViolation,
} from "effect/sql/SqlError";

import { DatabaseError, DatabaseUnavailable, exec, maybeRow, row, rows } from "../src/Database.js";

const Row = Schema.Struct({ id: Schema.String, at: Schema.DateTimeUtcFromDate });

const statement = <A>(values: ReadonlyArray<A>) => Effect.succeed(values);

const failing = (reason: SqlError["reason"]): Effect.Effect<ReadonlyArray<never>, SqlError> =>
  Effect.fail(new SqlError({ reason }));

const defectOf = <A, E>(self: Effect.Effect<A, E>) =>
  Effect.exit(self).pipe(Effect.map(Exit.findDefect), Effect.flatMap(Effect.fromResult));

describe("row decoding", () => {
  // A Date, because that is what the driver hands back for a timestamptz column.
  const at = DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-02T03:04:05.000Z"));

  it.effect("decodes every row through the schema", () =>
    Effect.gen(function* () {
      const decoded = yield* statement([
        { id: "a", at },
        { id: "b", at },
      ]).pipe(rows(Row));

      expect(decoded.map((r) => r.id)).toEqual(["a", "b"]);
      // The column is a Date on the wire and a DateTime.Utc in the domain; the decode
      // is what makes that true.
      expect(decoded.map((r) => DateTime.isUtc(r.at))).toEqual([true, true]);
    }),
  );

  it.effect("returns none from maybeRow for an empty result", () =>
    Effect.gen(function* () {
      assertNone(yield* statement([]).pipe(maybeRow(Row)));
    }),
  );

  it.effect("decodes the first row from maybeRow", () =>
    Effect.gen(function* () {
      const decoded = yield* statement([{ id: "a", at }]).pipe(maybeRow(Row));
      assertSome(
        Option.map(decoded, (r) => r.id),
        "a",
      );
    }),
  );

  it.effect("dies when row expects a row and gets none", () =>
    Effect.gen(function* () {
      const defect = yield* defectOf(statement([]).pipe(row(Row)));
      expect(String(defect)).toContain("expected one row");
    }),
  );

  it.effect("dies on a row that does not match its schema, rather than failing typed", () =>
    Effect.gen(function* () {
      const defect = yield* defectOf(statement([{ id: 42, at }]).pipe(rows(Row)));
      expect(defect).toBeDefined();
    }),
  );
});

describe("SqlError translation", () => {
  const causeWithCode = (code: string) => ({ message: "pg", code });

  it.effect("maps a unique violation to a permanent DatabaseError", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        failing(
          new UniqueViolation({ cause: causeWithCode("23505"), constraint: "todos_pkey" }),
        ).pipe(exec),
      );

      assertInstanceOf(error, DatabaseError);
      expect(error.type).toBe("unique_violation");
    }),
  );

  // 23503 arrives as ConstraintError alongside 23502/23514, so only the SQLSTATE
  // on the cause distinguishes a foreign-key violation.
  it.effect("maps SQLSTATE 23503 to a foreign_key_violation", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        failing(new ConstraintError({ cause: causeWithCode("23503") })).pipe(exec),
      );

      assertInstanceOf(error, DatabaseError);
      expect(error.type).toBe("foreign_key_violation");
    }),
  );

  it.effect("dies on a constraint violation the application has no vocabulary for", () =>
    Effect.gen(function* () {
      const defect = yield* defectOf(
        failing(new ConstraintError({ cause: causeWithCode("23502") })).pipe(exec),
      );

      expect(defect).toBeInstanceOf(SqlError);
    }),
  );

  it.effect("maps a retryable failure to DatabaseUnavailable", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        failing(new ConnectionError({ cause: causeWithCode("08006") })).pipe(exec),
      );

      assertInstanceOf(error, DatabaseUnavailable);
    }),
  );

  // Both are logged and surfaced through `String(...)`/`.message`, so they carry the
  // driver's own text rather than the schema-generated tag dump.
  it.effect("reads a translated failure as the driver's message, named by its kind", () =>
    Effect.gen(function* () {
      const unique = new SqlError({
        reason: new UniqueViolation({ cause: causeWithCode("23505"), constraint: "todos_pkey" }),
      });

      const unavailable = new SqlError({
        reason: new ConnectionError({ cause: causeWithCode("08006") }),
      });

      const permanent = yield* Effect.flip(failing(unique.reason).pipe(exec));
      const transient = yield* Effect.flip(failing(unavailable.reason).pipe(exec));

      expect(permanent.message).toBe(unique.message);
      expect(String(permanent)).toBe(`DatabaseError: ${unique.message}`);
      expect(transient.message).toBe(unavailable.message);
      expect(String(transient)).toBe(`DatabaseUnavailable: ${unavailable.message}`);
    }),
  );

  it.effect("dies on a syntax error", () =>
    Effect.gen(function* () {
      const defect = yield* defectOf(
        failing(new SqlSyntaxError({ cause: causeWithCode("42601") })).pipe(exec),
      );

      expect(defect).toBeInstanceOf(SqlError);
    }),
  );
});
