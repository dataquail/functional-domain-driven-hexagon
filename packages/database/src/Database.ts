import type * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Runtime from "effect/Runtime";
import * as Slonik from "slonik";

export type Client = Slonik.DatabasePool;
export type TxClient = Slonik.DatabaseTransactionConnection;
export type AnyClient = Client | TxClient;

type TransactionContextShape = <U>(
  fn: (client: TxClient) => Promise<U>,
) => Effect.Effect<U, DatabaseError | DatabaseUnavailable>;

export class TransactionContext extends Context.Tag("TransactionContext")<
  TransactionContext,
  TransactionContextShape
>() {
  public static readonly provide = (
    transaction: TransactionContextShape,
  ): (<A, E, R>(
    self: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, Exclude<R, TransactionContext>>) =>
    Effect.provideService(this, transaction);
}

// `DatabaseError` now carries only *permanent* failures — constraint
// violations the application is expected to either translate to a domain
// error (e.g. `unique_violation` → `UserAlreadyExists`) or treat as a
// defect (programmer error or schema drift). Transient failures
// (connection lost, backend terminated) are surfaced as
// `DatabaseUnavailable` so use cases can propagate them through their
// typed error channel and the HTTP layer can map them to 503.
//
// This split lets command handlers drop the blanket
// `Effect.catchTag("DatabaseError", Effect.die)` — they can still die on
// unhandled constraint violations (those mean the repo missed a case)
// while letting `DatabaseUnavailable` flow through.
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly type: "unique_violation" | "foreign_key_violation";
  readonly cause: unknown;
  readonly errorMessage: string;
}> {
  public override toString() {
    return `DatabaseError: ${this.errorMessage}`;
  }

  public get message() {
    return this.errorMessage;
  }
}

// Transient failure: the pool is unable to talk to Postgres right now.
// Distinct from `DatabaseConnectionLostError` (which is raised by the
// pool-level connection listener and tears the server down for a
// restart). `DatabaseUnavailable` is a per-query signal — the right
// reaction is a 503 to this caller; the next request might succeed.
export class DatabaseUnavailable extends Data.TaggedError("DatabaseUnavailable")<{
  readonly cause: unknown;
  readonly errorMessage: string;
}> {
  public override toString() {
    return `DatabaseUnavailable: ${this.errorMessage}`;
  }

  public get message() {
    return this.errorMessage;
  }
}

const matchSlonikError = (error: unknown): DatabaseError | DatabaseUnavailable | null => {
  if (error instanceof Slonik.UniqueIntegrityConstraintViolationError) {
    return new DatabaseError({
      type: "unique_violation",
      cause: error,
      errorMessage: error.message,
    });
  }
  if (error instanceof Slonik.ForeignKeyIntegrityConstraintViolationError) {
    return new DatabaseError({
      type: "foreign_key_violation",
      cause: error,
      errorMessage: error.message,
    });
  }
  if (
    error instanceof Slonik.ConnectionError ||
    error instanceof Slonik.BackendTerminatedError ||
    error instanceof Slonik.BackendTerminatedUnexpectedlyError
  ) {
    return new DatabaseUnavailable({
      cause: error,
      errorMessage: error.message,
    });
  }
  return null;
};

export class DatabaseConnectionLostError extends Data.TaggedError("DatabaseConnectionLostError")<{
  cause: unknown;
  message: string;
}> {}

export type Config = {
  url: Redacted.Redacted;
  ssl: boolean;
};

const makeService = (config: Config) =>
  Effect.gen(function* () {
    // Slonik's default int8 parser returns native BigInt. Match the prior
    // drizzle config (`bigint(..., { mode: "number" })`) by parsing int8 to
    // a Number, accepting the precision loss above 2^53 just like before.
    //
    // Slonik also defaults timestamp / timestamptz to a Unix-millis number,
    // but our row schemas (RowSchemas.*) declare these columns as
    // `Schema.DateFromSelf` (i.e. real `Date` instances). Override the two
    // parsers so reads produce Dates and the mappers' `DateTime.unsafeFromDate`
    // calls work without a conversion shim in every mapper.
    const typeParsers = Slonik.createTypeParserPreset().map((p) => {
      if (p.name === "int8") {
        return { name: "int8" as const, parse: (value: string) => Number(value) };
      }
      if (p.name === "timestamp") {
        return {
          name: "timestamp" as const,
          parse: (value: string) => new Date(`${value} UTC`),
        };
      }
      if (p.name === "timestamptz") {
        return {
          name: "timestamptz" as const,
          parse: (value: string) => new Date(value),
        };
      }
      return p;
    });

    // Slonik 48 stores the row's `resultParser` (StandardSchemaV1) in the
    // query context but doesn't actually execute it — it expects an
    // interceptor to run validation. Without this, `sql.type(SchemaStd)` is a
    // type-level annotation only, and rows are passed through unchecked
    // (which is how a Date column claiming `Schema.DateFromSelf` reached a
    // mapper as a number). This interceptor closes the loop: every read row
    // is validated and decoded by the schema, so mappers can trust types.
    const resultParserInterceptor: Slonik.Interceptor = {
      name: "effect-monorepo/result-parser",
      transformRowAsync: async (queryContext, query, row) => {
        const parser = queryContext.resultParser;
        if (parser === undefined) return row;
        const validation = parser["~standard"].validate(row);
        const result = validation instanceof Promise ? await validation : validation;
        if (result.issues !== undefined) {
          throw new Slonik.SchemaValidationError(query, row, result.issues);
        }
        return result.value as Slonik.QueryResultRow;
      },
    };

    const pool: Slonik.DatabasePool = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          Slonik.createPool(Redacted.value(config.url), {
            ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
            typeParsers,
            interceptors: [resultParserInterceptor],
          } as Slonik.ClientConfigurationInput),
        catch: (cause) =>
          new DatabaseConnectionLostError({
            cause,
            message: "[Database] Failed to create pool",
          }),
      }),
      (p) => Effect.promise(() => p.end()),
    );

    yield* Effect.tryPromise(() => pool.query(Slonik.sql.unsafe`SELECT 1`)).pipe(
      Effect.timeoutFail({
        duration: "10 seconds",
        onTimeout: () =>
          new DatabaseConnectionLostError({
            cause: new Error("[Database] Failed to connect: timeout"),
            message: "[Database] Failed to connect: timeout",
          }),
      }),
      Effect.catchTag(
        "UnknownException",
        (error) =>
          new DatabaseConnectionLostError({
            cause: error.cause,
            message: "[Database] Failed to connect",
          }),
      ),
      Effect.tap(() =>
        Effect.logInfo("[Database client]: Connection to the database established."),
      ),
    );

    const setupConnectionListeners = Effect.zipRight(
      Effect.async<void, DatabaseConnectionLostError>((resume) => {
        pool.on("error", (error) => {
          // Slonik emits pool 'error' for every query error, not just connection
          // loss. Only tear the pool down on actual connection failures —
          // integrity violations are surfaced through the query's own error
          // channel and must not crash the server.
          if (
            !(error instanceof Slonik.ConnectionError) &&
            !(error instanceof Slonik.BackendTerminatedError) &&
            !(error instanceof Slonik.BackendTerminatedUnexpectedlyError)
          ) {
            return;
          }
          resume(
            Effect.fail(
              new DatabaseConnectionLostError({
                cause: error,
                message: error.message,
              }),
            ),
          );
        });

        return Effect.sync(() => {
          // Slonik's StrictEventEmitter intersection makes
          // removeAllListeners' type lose its callable signature for the
          // narrowed event union. The runtime call is safe.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          pool.removeAllListeners("error");
        });
      }),
      Effect.logInfo("[Database client]: Connection error listeners initialized."),
      {
        concurrent: true,
      },
    );

    const execute = Effect.fn(<T>(fn: (client: Client) => Promise<T>) =>
      Effect.tryPromise({
        try: () => fn(pool),
        catch: (cause) => {
          const error = matchSlonikError(cause);
          if (error !== null) {
            return error;
          }
          throw cause;
        },
      }),
    );

    // Slonik rolls back when the transaction handler throws. Returning normally
    // commits, so on inner Effect failure we throw a sentinel carrying the
    // Cause and re-surface it via Effect.failCause in the outer handler — which
    // preserves the original typed error channel.
    class TxFailure<E> {
      constructor(public readonly cause: Cause.Cause<E>) {}
    }

    // Shared Effect↔Slonik bridge for both top-level transactions and nested
    // savepoints. `open` is the Slonik call that begins the scope and runs our
    // handler against the scoped connection — `pool.transaction` for a
    // top-level transaction, a transaction connection's own `.transaction`
    // (which Slonik implements as `SAVEPOINT` / `ROLLBACK TO SAVEPOINT`) for a
    // nested savepoint. The handler provides the scoped client as a
    // `TransactionContext`, runs the caller's effect to an `Exit`, and either
    // returns its value (commit / release) or throws `TxFailure` carrying the
    // Cause (rollback). On the Effect side we re-surface that Cause verbatim so
    // the caller's typed error channel survives the round-trip through Slonik.
    const runInSlonikTx = <T, E, R>(
      open: (handler: (client: TxClient) => Promise<T>) => Promise<T>,
      txExecute: (tx: TransactionContextShape) => Effect.Effect<T, E, R>,
    ): Effect.Effect<T, DatabaseError | DatabaseUnavailable | E, R> =>
      Effect.runtime<R>().pipe(
        Effect.map((runtime) => Runtime.runPromiseExit(runtime)),
        Effect.flatMap((runPromiseExit) =>
          Effect.async<T, DatabaseError | DatabaseUnavailable | E, R>((resume) => {
            open(async (client: TxClient) => {
              const txWrapper = (fn: (c: TxClient) => Promise<any>) =>
                Effect.tryPromise({
                  try: () => fn(client),
                  catch: (cause) => {
                    const error = matchSlonikError(cause);
                    if (error !== null) {
                      return error;
                    }
                    throw cause;
                  },
                });

              const result = await runPromiseExit(txExecute(txWrapper));
              if (Exit.isSuccess(result)) {
                return result.value;
              }
              throw new TxFailure(result.cause);
            }).then(
              (value) => {
                resume(Effect.succeed(value));
              },
              (cause: unknown) => {
                if (cause instanceof TxFailure) {
                  resume(Effect.failCause(cause.cause as Cause.Cause<E>));
                  return;
                }
                const error = matchSlonikError(cause);
                resume(error !== null ? Effect.fail(error) : Effect.die(cause));
              },
            );
          }),
        ),
      );

    const transaction = Effect.fn("Database.transaction")(
      <T, E, R>(txExecute: (tx: TransactionContextShape) => Effect.Effect<T, E, R>) =>
        runInSlonikTx<T, E, R>((handler) => pool.transaction(handler), txExecute),
    );

    // Open a nested savepoint on the ambient transaction. Requires a
    // `TransactionContext` in scope — it is the re-entrant arm of a unit of
    // work (`UnitOfWorkLive.run` calls this when a `run` is nested inside
    // another). We pull the live transaction connection out of the ambient
    // context and ask Slonik for a nested transaction on it, which emits a
    // `SAVEPOINT`. A caught failure inside rolls back only to the savepoint,
    // leaving the outer transaction free to commit; success releases it.
    const savepoint = Effect.fn("Database.savepoint")(
      <T, E, R>(spExecute: (sp: TransactionContextShape) => Effect.Effect<T, E, R>) =>
        Effect.flatMap(TransactionContext, (existingTx) =>
          existingTx((tx) => Promise.resolve(tx)).pipe(
            Effect.flatMap((tx) =>
              runInSlonikTx<T, E, R>((handler) => tx.transaction(handler), spExecute),
            ),
          ),
        ),
    );

    type ExecuteFn = <T>(
      fn: (client: AnyClient) => Promise<T>,
    ) => Effect.Effect<T, DatabaseError | DatabaseUnavailable>;
    const makeQuery =
      <A, E, R, Input = never>(
        queryFn: (execute: ExecuteFn, input: Input) => Effect.Effect<A, E, R>,
      ) =>
      (...args: [Input] extends [never] ? [] : [input: Input]): Effect.Effect<A, E, R> => {
        const input = args[0] as Input;
        return Effect.serviceOption(TransactionContext).pipe(
          Effect.map(Option.getOrNull),
          Effect.flatMap((txOrNull) => queryFn(txOrNull ?? execute, input)),
        );
      };

    return {
      execute,
      transaction,
      savepoint,
      setupConnectionListeners,
      makeQuery,
    } as const;
  });

type Shape = Effect.Effect.Success<ReturnType<typeof makeService>>;

export class Database extends Effect.Tag("Database")<Database, Shape>() {}

export const layer = (config: Config) => Layer.scoped(Database, makeService(config));
