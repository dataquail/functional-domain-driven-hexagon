import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/sql/SqlClient";
import { isSqlError, type SqlError } from "effect/sql/SqlError";

import { type Config, driverLayer, jsonb, textArray, uuidArray } from "./pg-driver.js";

export type { Config };

export { jsonb, textArray, uuidArray };

// `DatabaseError` carries only *permanent* failures — constraint violations the
// application is expected to either translate to a domain error (e.g.
// `unique_violation` → `UserAlreadyExists`) or treat as a defect. Transient
// failures are surfaced as `DatabaseUnavailable` so use cases can propagate them
// through their typed error channel and the HTTP layer can map them to 503.
export class DatabaseError extends Schema.TaggedError<
  DatabaseError,
  { readonly brand: "DatabaseError" }
>()("DatabaseError", {
  type: Schema.Literals(["unique_violation", "foreign_key_violation"]),
  cause: Schema.Defect(),
  errorMessage: Schema.String,
}) {
  public override toString() {
    return `DatabaseError: ${this.errorMessage}`;
  }

  public override get message() {
    return this.errorMessage;
  }
}

export class DatabaseUnavailable extends Schema.TaggedError<
  DatabaseUnavailable,
  { readonly brand: "DatabaseUnavailable" }
>()("DatabaseUnavailable", {
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

const DriverErrorCode = Schema.Struct({ code: Schema.String });

const decodeDriverErrorCode = Schema.decodeUnknownOption(DriverErrorCode);

// `classifyError` folds every SQLSTATE 23xxx except 23505 into `ConstraintError`,
// so foreign-key violations are only distinguishable by the code on the cause.
const isForeignKeyViolation = (cause: unknown): boolean =>
  Option.exists(decodeDriverErrorCode(cause), ({ code }) => code === FOREIGN_KEY_VIOLATION);

const toDatabaseFailure = (error: SqlError): Option.Option<DatabaseError | DatabaseUnavailable> => {
  const errorMessage = error.message;
  const { reason } = error;

  if (Predicate.isTagged(reason, "UniqueViolation")) {
    return Option.some(new DatabaseError({ type: "unique_violation", cause: error, errorMessage }));
  }

  if (Predicate.isTagged(reason, "ConstraintError") && isForeignKeyViolation(reason.cause)) {
    return Option.some(
      new DatabaseError({ type: "foreign_key_violation", cause: error, errorMessage }),
    );
  }

  if (error.isRetryable) {
    return Option.some(new DatabaseUnavailable({ cause: error, errorMessage }));
  }

  return Option.none();
};

// A failure the application has no vocabulary for — a syntax error, a NOT NULL
// violation, a schema that drifted — is a programmer error, not a typed outcome.
export const mapSqlError = <A, E, R>(
  self: Effect.Effect<A, E | SqlError, R>,
): Effect.Effect<A, Exclude<E, SqlError> | DatabaseError | DatabaseUnavailable, R> =>
  Effect.catchIf<A, E | SqlError, R, SqlError, never, DatabaseError | DatabaseUnavailable, never>(
    self,
    isSqlError,
    (error) =>
      Option.match(toDatabaseFailure(error), {
        onNone: () => Effect.die(error),
        onSome: Effect.fail,
      }),
  );

export class Database extends Context.Service<Database, SqlClient>()("Database") {}

export const layer = (config: Config): Layer.Layer<Database, SqlError> =>
  Layer.effect(Database, SqlClient).pipe(Layer.provide(driverLayer(config)));

type Statement<A> = Effect.Effect<ReadonlyArray<A>, SqlError>;

// A row that does not match its schema is drift — a programmer error, not a typed outcome.
const decoder = <S extends Schema.Constraint>(rowSchema: S) => {
  const decode = Schema.decodeUnknownEffect(rowSchema);

  return <Raw>(raw: Raw): Effect.Effect<S["Type"], never, S["DecodingServices"]> =>
    Effect.orDie(decode(raw));
};

export const rows =
  <S extends Schema.Constraint>(rowSchema: S) =>
  <Raw>(
    self: Statement<Raw>,
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
  <Raw>(
    self: Statement<Raw>,
  ): Effect.Effect<
    Option.Option<S["Type"]>,
    DatabaseError | DatabaseUnavailable,
    S["DecodingServices"]
  > => {
    const decode = decoder(rowSchema);

    return mapSqlError(self).pipe(
      Effect.flatMap((raw) => Effect.transposeOption(Option.map(Arr.head(raw), decode))),
    );
  };

export const row =
  <S extends Schema.Constraint>(rowSchema: S) =>
  <Raw>(
    self: Statement<Raw>,
  ): Effect.Effect<S["Type"], DatabaseError | DatabaseUnavailable, S["DecodingServices"]> => {
    const decode = decoder(rowSchema);

    return mapSqlError(self).pipe(
      Effect.flatMap((raw) =>
        Option.match(Arr.head(raw), {
          onNone: () => Effect.die(new Error("[Database.row] expected one row, got none")),
          onSome: decode,
        }),
      ),
    );
  };

export const exec = <R>(
  self: Effect.Effect<unknown, SqlError, R>,
): Effect.Effect<void, DatabaseError | DatabaseUnavailable, R> => Effect.asVoid(mapSqlError(self));
