import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import { type SqlError } from "effect/unstable/sql/SqlError";

import { type Config, driverLayer } from "./pg-driver.js";

export type { Config };

// `DatabaseError` carries only *permanent* failures — constraint violations the
// application is expected to either translate to a domain error (e.g.
// `unique_violation` → `UserAlreadyExists`) or treat as a defect. Transient
// failures are surfaced as `DatabaseUnavailable` so use cases can propagate them
// through their typed error channel and the HTTP layer can map them to 503.
export class DatabaseError extends Schema.TaggedErrorClass<DatabaseError>("DatabaseError")(
  "DatabaseError",
  {
    type: Schema.Literals(["unique_violation", "foreign_key_violation"]),
    cause: Schema.Defect(),
    errorMessage: Schema.String,
  },
) {
  public override toString() {
    return `DatabaseError: ${this.errorMessage}`;
  }

  public override get message() {
    return this.errorMessage;
  }
}

export class DatabaseUnavailable extends Schema.TaggedErrorClass<DatabaseUnavailable>(
  "DatabaseUnavailable",
)("DatabaseUnavailable", {
  cause: Schema.Defect(),
  errorMessage: Schema.String,
}) {
  public override toString() {
    return `DatabaseUnavailable: ${this.errorMessage}`;
  }

  public override get message() {
    return this.errorMessage;
  }
}

const FOREIGN_KEY_VIOLATION = "23503";

// `classifyError` folds every SQLSTATE 23xxx except 23505 into `ConstraintError`,
// so foreign-key violations are only distinguishable by the code on the cause.
const sqlStateOf = (cause: unknown): string | undefined =>
  typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string"
    ? cause.code
    : undefined;

const toDatabaseFailure = (error: SqlError): DatabaseError | DatabaseUnavailable | null => {
  const errorMessage = error.message;
  if (error.reason._tag === "UniqueViolation") {
    return new DatabaseError({ type: "unique_violation", cause: error, errorMessage });
  }
  if (
    error.reason._tag === "ConstraintError" &&
    sqlStateOf(error.reason.cause) === FOREIGN_KEY_VIOLATION
  ) {
    return new DatabaseError({ type: "foreign_key_violation", cause: error, errorMessage });
  }
  if (error.isRetryable) {
    return new DatabaseUnavailable({ cause: error, errorMessage });
  }
  return null;
};

// A failure the application has no vocabulary for — a syntax error, a NOT NULL
// violation, a schema that drifted — is a programmer error, not a typed outcome.
//
// `catchTag` on a generic union channel resists inference, so the implementation
// catches on the widened type and re-asserts the narrowed result. The casts are
// contained here so callers stay clean.
export const mapSqlError: <A, E, R>(
  self: Effect.Effect<A, E | SqlError, R>,
) => Effect.Effect<A, Exclude<E, SqlError> | DatabaseError | DatabaseUnavailable, R> = <A, E, R>(
  self: Effect.Effect<A, E | SqlError, R>,
) =>
  Effect.catchTag(self as Effect.Effect<A, SqlError, R>, "SqlError", (error: SqlError) => {
    const failure = toDatabaseFailure(error);
    return failure === null ? Effect.die(error) : Effect.fail(failure);
  }) as Effect.Effect<A, Exclude<E, SqlError> | DatabaseError | DatabaseUnavailable, R>;

export class Database extends Context.Service<Database, SqlClient>()("Database") {}

export const layer = (config: Config): Layer.Layer<Database, SqlError> =>
  Layer.effect(Database, SqlClient).pipe(Layer.provide(driverLayer(config)));

type Statement<A> = Effect.Effect<ReadonlyArray<A>, SqlError>;

// A row that does not match its schema is drift — a programmer error, not a typed outcome.
const decoder = <S extends Schema.Constraint>(rowSchema: S) => {
  const decode = Schema.decodeUnknownEffect(rowSchema);
  return (raw: unknown): Effect.Effect<S["Type"], never, S["DecodingServices"]> =>
    Effect.orDie(decode(raw));
};

export const rows =
  <S extends Schema.Constraint>(rowSchema: S) =>
  (
    self: Statement<unknown>,
  ): Effect.Effect<
    ReadonlyArray<S["Type"]>,
    DatabaseError | DatabaseUnavailable,
    S["DecodingServices"]
  > => {
    const decode = decoder(rowSchema);
    return mapSqlError(self).pipe(Effect.flatMap(Effect.forEach(decode)));
  };

export const maybeRow =
  <S extends Schema.Constraint>(rowSchema: S) =>
  (
    self: Statement<unknown>,
  ): Effect.Effect<
    S["Type"] | null,
    DatabaseError | DatabaseUnavailable,
    S["DecodingServices"]
  > => {
    const decode = decoder(rowSchema);
    return mapSqlError(self).pipe(
      Effect.flatMap((raw) => (raw.length === 0 ? Effect.succeed(null) : decode(raw[0]))),
    );
  };

export const row =
  <S extends Schema.Constraint>(rowSchema: S) =>
  (
    self: Statement<unknown>,
  ): Effect.Effect<S["Type"], DatabaseError | DatabaseUnavailable, S["DecodingServices"]> => {
    const decode = decoder(rowSchema);
    return mapSqlError(self).pipe(
      Effect.flatMap((raw) =>
        raw.length === 0
          ? Effect.die(new Error("[Database.row] expected one row, got none"))
          : decode(raw[0]),
      ),
    );
  };

export const exec = <R>(
  self: Effect.Effect<unknown, SqlError, R>,
): Effect.Effect<void, DatabaseError | DatabaseUnavailable, R> => Effect.asVoid(mapSqlError(self));
