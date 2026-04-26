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
) => Effect.Effect<U, DatabaseError>;

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

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly type: "unique_violation" | "foreign_key_violation" | "connection_error";
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

const matchSlonikError = (error: unknown): DatabaseError | null => {
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
    return new DatabaseError({
      type: "connection_error",
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
    const typeParsers = Slonik.createTypeParserPreset().map((p) =>
      p.name === "int8" ? { name: "int8" as const, parse: (value: string) => Number(value) } : p,
    );

    const pool: Slonik.DatabasePool = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          Slonik.createPool(Redacted.value(config.url), {
            ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
            typeParsers,
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

    const transaction = Effect.fn("Database.transaction")(
      <T, E, R>(txExecute: (tx: TransactionContextShape) => Effect.Effect<T, E, R>) =>
        Effect.runtime<R>().pipe(
          Effect.map((runtime) => Runtime.runPromiseExit(runtime)),
          Effect.flatMap((runPromiseExit) =>
            Effect.async<T, DatabaseError | E, R>((resume) => {
              pool
                .transaction(async (tx: TxClient) => {
                  const txWrapper = (fn: (client: TxClient) => Promise<any>) =>
                    Effect.tryPromise({
                      try: () => fn(tx),
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
                })
                .then(
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
        ),
    );

    type ExecuteFn = <T>(fn: (client: AnyClient) => Promise<T>) => Effect.Effect<T, DatabaseError>;
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
      setupConnectionListeners,
      makeQuery,
    } as const;
  });

type Shape = Effect.Effect.Success<ReturnType<typeof makeService>>;

export class Database extends Effect.Tag("Database")<Database, Shape>() {}

export const layer = (config: Config) => Layer.scoped(Database, makeService(config));
