import { Database } from "@org/database/index";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { PostCommitBuffer } from "@/platform/ddd/contracts/post-commit-buffer.js";
import { IntegrationEventBus } from "@/platform/ddd/ports/integration-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Production binding for the `UnitOfWork` port. A `run` is the atomicity
// boundary for a logical operation; it also owns the two domain-event
// consistency models (ADR-0007):
//
//   - Immediate (in-fiber) events go through `DomainEventBus`, run inside this
//     transaction, and roll the publisher back on failure.
//   - Eventual (post-commit) events go through `IntegrationEventBus`, which
//     appends them to the `PostCommitBuffer` this layer provides. Only the
//     OUTERMOST `run` drains that buffer, AFTER its transaction commits — each
//     handler in its own fresh transaction, its failure logged and isolated so
//     it can never undo the already-committed producer.
//
// Tests that don't need a database wire `IdentityUnitOfWork` from `test-utils/`.
//
// `run` is re-entrant: if a `TransactionContext` is already in scope (we're
// nested inside an outer `run` — e.g. a command fired from within another
// command's unit of work), we open a real SAVEPOINT on that existing
// transaction rather than a second connection. A nested failure that the
// caller catches rolls back only to the savepoint, leaving the outer unit of
// work free to commit; an uncaught nested failure propagates and rolls the
// whole thing back. A rolled-back savepoint also truncates the post-commit
// buffer back to its entry length, so integration events emitted inside it
// never flush. Bare (top-level) calls open a real `db.transaction`.
//
// The `DatabaseUnavailable` translation happens here so commands and
// event-handlers downstream only see `PersistenceUnavailable` (the
// domain-language port-level signal). Without it, calling code would
// need to know about `@org/database`'s specific error tag — leaking
// the SQL implementation through the typed channel.
export const UnitOfWorkLive: Layer.Layer<UnitOfWork, never, Database.Database> = Layer.effect(
  UnitOfWork,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // The ambient post-commit buffer for a nested run, or a throwaway if none is
    // in scope. In practice the outermost run always provides one; the fallback
    // keeps the nested branch total (and its type uniform with the outermost).
    const resolveBuffer = Effect.gen(function* () {
      const existing = yield* Effect.serviceOption(PostCommitBuffer);
      return Option.isSome(existing)
        ? existing.value
        : yield* Ref.make<ReadonlyArray<DomainEvent>>([]);
    });

    // Drain the post-commit buffer after the outermost transaction commits.
    // Each integration handler runs in its own fresh transaction; a failure is
    // logged and swallowed (the producer already committed — eventual
    // consistency, failure isolated).
    //
    // The `IntegrationEventBus` is read from the ambient context at flush time
    // (not captured as a layer dependency). That keeps `UnitOfWorkLive`'s layer
    // requirement to `Database` alone — the same shape as before the second bus
    // existed — so wiring it at composition roots needs no `Exclude`-based
    // discharge. The bus is present in the runtime context wherever a unit of
    // work runs; if it somehow isn't, there are no post-commit handlers to run.
    const flushPostCommit = (buffer: Ref.Ref<ReadonlyArray<DomainEvent>>) =>
      Effect.gen(function* () {
        const maybeBus = yield* Effect.serviceOption(IntegrationEventBus);
        if (Option.isNone(maybeBus)) return;
        const integrationBus = maybeBus.value;
        const events = yield* Ref.get(buffer);
        for (const event of events) {
          const handlers = yield* integrationBus.handlersFor(event._tag);
          for (const handler of handlers) {
            yield* db
              .transaction((tx) => handler(event).pipe(Database.TransactionContext.provide(tx)))
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.logError(`Integration event handler failed for ${event._tag}`, cause),
                ),
                Effect.withSpan(`integrationEvent:${event._tag}`),
              );
          }
        }
      });

    return UnitOfWork.of({
      run: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        Effect.serviceOption(Database.TransactionContext)
          .pipe(
            Effect.flatMap((existing) =>
              // Resolve the post-commit buffer (fresh at the outermost, the
              // ambient one when nested) and provide it to `effect` inside each
              // branch — providing `PostCommitBuffer` onto the `db.transaction`/
              // `db.savepoint` *result* (rather than onto the input `effect`)
              // trips a `tsc -b` declaration-emit assertion. The branches differ
              // only in how `Exclude` nests, so the callback's annotated return
              // type unifies them by R-widening.
              resolveBuffer.pipe(
                Effect.flatMap(
                  (
                    buffer,
                  ): Effect.Effect<
                    A,
                    Database.DatabaseError | Database.DatabaseUnavailable | E,
                    Exclude<R, Database.TransactionContext>
                  > =>
                    Option.isSome(existing)
                      ? // Nested: savepoint on the ambient transaction; snapshot
                        // the buffer on entry and truncate back on rollback so
                        // integration events emitted inside it never flush.
                        Ref.get(buffer).pipe(
                          Effect.flatMap((before) =>
                            db
                              .savepoint((sp) =>
                                effect.pipe(
                                  Effect.provide(Context.make(PostCommitBuffer, buffer)),
                                  Database.TransactionContext.provide(sp),
                                ),
                              )
                              .pipe(
                                Database.TransactionContext.provide(existing.value),
                                Effect.tapCause(() =>
                                  Ref.update(buffer, (b) => b.slice(0, before.length)),
                                ),
                              ),
                          ),
                        )
                      : // Outermost: run the transaction, then flush the buffer
                        // once it commits (`Effect.tap` runs on success only — a
                        // rollback skips it and the buffer dies with the effect).
                        db
                          .transaction((tx) =>
                            effect.pipe(
                              Effect.provide(Context.make(PostCommitBuffer, buffer)),
                              Database.TransactionContext.provide(tx),
                            ),
                          )
                          .pipe(Effect.tap(() => flushPostCommit(buffer))),
                ),
              ),
            ),
          )
          .pipe(
            // `catchTag` widens `e` to `{ _tag: "DatabaseUnavailable" }` because
            // the generic `E` from the caller could include any shape with
            // that tag. We runtime-guarantee `e` is the real
            // `Database.DatabaseUnavailable` (it came from `db.transaction`);
            // the local cast carries that knowledge across the inference gap.
            Effect.catchTag("DatabaseUnavailable", (e) =>
              Effect.fail(
                new PersistenceUnavailable({
                  message: (e as Database.DatabaseUnavailable).message,
                }),
              ),
            ),
          ),
    });
  }),
);
