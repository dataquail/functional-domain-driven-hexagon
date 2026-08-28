import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import {
  ConnectionError,
  ConstraintError,
  SqlError,
  SqlSyntaxError,
  UniqueViolation,
} from "effect/unstable/sql/SqlError";

import { exec, maybeRow, row, rows } from "../src/Database.js";

const Row = Schema.Struct({ id: Schema.String, at: Schema.DateTimeUtcFromDate });

const statement = (values: ReadonlyArray<unknown>) => Effect.succeed(values);

const failing = (reason: SqlError["reason"]) =>
  Effect.fail(new SqlError({ reason })) as Effect.Effect<ReadonlyArray<unknown>, SqlError>;

const failureOf = <A, E>(exit: Exit.Exit<A, E>): E => {
  const reason = Exit.isFailure(exit) ? exit.cause.reasons[0] : undefined;
  if (reason?._tag !== "Fail") throw new Error("expected a typed failure");
  return reason.error;
};

const defectOf = <A, E>(exit: Exit.Exit<A, E>): unknown => {
  const reason = Exit.isFailure(exit) ? exit.cause.reasons[0] : undefined;
  if (reason?._tag !== "Die") throw new Error("expected a defect");
  return reason.defect;
};

describe("row decoding", () => {
  const at = new Date("2026-01-02T03:04:05.000Z");

  it("decodes every row through the schema", async () => {
    const decoded = await Effect.runPromise(
      statement([
        { id: "a", at },
        { id: "b", at },
      ]).pipe(rows(Row)),
    );
    expect(decoded.map((r) => r.id)).toEqual(["a", "b"]);
    // The column is a Date on the wire and a DateTime.Utc in the domain; the decode
    // is what makes that true.
    expect(decoded.map((r) => r.at._tag)).toEqual(["Utc", "Utc"]);
  });

  it("returns null from maybeRow for an empty result", async () => {
    const decoded = await Effect.runPromise(statement([]).pipe(maybeRow(Row)));
    expect(decoded).toBeNull();
  });

  it("decodes the first row from maybeRow", async () => {
    const decoded = await Effect.runPromise(statement([{ id: "a", at }]).pipe(maybeRow(Row)));
    expect(decoded?.id).toBe("a");
  });

  it("dies when row expects a row and gets none", async () => {
    const exit = await Effect.runPromiseExit(statement([]).pipe(row(Row)));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(defectOf(exit))).toContain("expected one row");
  });

  it("dies on a row that does not match its schema, rather than failing typed", async () => {
    const exit = await Effect.runPromiseExit(statement([{ id: 42, at }]).pipe(rows(Row)));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(defectOf(exit)).toBeDefined();
  });
});

describe("SqlError translation", () => {
  const causeWithCode = (code: string) => Object.assign(new Error("pg"), { code });

  it("maps a unique violation to a permanent DatabaseError", async () => {
    const exit = await Effect.runPromiseExit(
      failing(
        new UniqueViolation({ cause: causeWithCode("23505"), constraint: "todos_pkey" }),
      ).pipe(exec),
    );
    const error = failureOf(exit);
    expect(error._tag).toBe("DatabaseError");
    expect(error._tag === "DatabaseError" && error.type).toBe("unique_violation");
  });

  // 23503 arrives as ConstraintError alongside 23502/23514, so only the SQLSTATE
  // on the cause distinguishes a foreign-key violation.
  it("maps SQLSTATE 23503 to a foreign_key_violation", async () => {
    const exit = await Effect.runPromiseExit(
      failing(new ConstraintError({ cause: causeWithCode("23503") })).pipe(exec),
    );
    const error = failureOf(exit);
    expect(error._tag === "DatabaseError" && error.type).toBe("foreign_key_violation");
  });

  it("dies on a constraint violation the application has no vocabulary for", async () => {
    const exit = await Effect.runPromiseExit(
      failing(new ConstraintError({ cause: causeWithCode("23502") })).pipe(exec),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(defectOf(exit)).toBeInstanceOf(SqlError);
  });

  it("maps a retryable failure to DatabaseUnavailable", async () => {
    const exit = await Effect.runPromiseExit(
      failing(new ConnectionError({ cause: causeWithCode("08006") })).pipe(exec),
    );
    expect(failureOf(exit)._tag).toBe("DatabaseUnavailable");
  });

  it("dies on a syntax error", async () => {
    const exit = await Effect.runPromiseExit(
      failing(new SqlSyntaxError({ cause: causeWithCode("42601") })).pipe(exec),
    );
    expect(defectOf(exit)).toBeInstanceOf(SqlError);
  });
});
