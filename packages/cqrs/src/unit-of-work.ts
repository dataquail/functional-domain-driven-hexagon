import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import type * as Event from "./event.js";
import { EventBus } from "./event-bus.js";
import type { PersistenceUnavailable } from "./persistence-unavailable.js";
import { TransactionDriver, type TransactionFailed } from "./transaction-driver.js";
import { reportUnhandled } from "./unhandled-failures.js";
import { UnitOfWorkScope } from "./unit-of-work-scope.js";

/**
 * "Run this effect inside a single unit of work" — the atomicity boundary for a
 * logical operation. Every repository write inside it commits together or is
 * discarded together, and every immediate event subscriber inherits that same
 * boundary.
 *
 * Use cases depend on this port and never on a datastore, which is what lets
 * them be unit-tested against a pass-through implementation.
 *
 * The requirement channel is unchanged. The boundary provides its scope handle
 * ambiently rather than through `R`, so an effect handed to `run` never declared
 * a requirement for one and there is nothing here to discharge.
 */
export interface UnitOfWorkShape {
  readonly run: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | TransactionFailed | PersistenceUnavailable, R>;
}

export class UnitOfWork extends Context.Service<UnitOfWork, UnitOfWorkShape>()(
  "@org/cqrs/UnitOfWork",
) {}

/**
 * Builds the unit of work over a host's atomicity primitive. This is where the
 * two event-consistency models meet: immediate subscribers run inside the scope
 * this opens, and after-commit ones accumulate on the scope for it to drain once
 * that scope has committed.
 *
 * `run` is re-entrant. A bare call opens a scope; a call already inside one
 * nests instead of reaching for a second connection. Whether a nested failure
 * is fatal to the whole operation is then the caller's choice — catching it
 * discards only the nested scope, letting it propagate discards everything.
 */
export const makeUnitOfWork = (): Layer.Layer<UnitOfWork, never, TransactionDriver> =>
  Layer.effect(
    UnitOfWork,
    Effect.gen(function* () {
      const driver = yield* TransactionDriver;

      /**
       * Drains the events an eventual bus buffered, once the scope that produced
       * them has committed. Each handler gets its own unit of work, so its
       * failure is isolated: the producer already committed and must not be
       * undone by a reaction.
       *
       * The bus is read from ambient context rather than declared as a layer
       * dependency, which keeps this layer's requirement to the driver alone. If
       * no bus is wired there is nothing buffered to drain.
       */
      const flushPostCommit = (buffered: ReadonlyArray<Event.Base>): Effect.Effect<void> =>
        Effect.gen(function* () {
          const bus = yield* Effect.serviceOption(EventBus);
          if (Option.isNone(bus)) return;

          // Stream consumers first, and not awaited: a process manager may run for
          // days, so holding the flush for one would stall every later reaction.
          // A handler failing below must not keep an event from reaching them.
          yield* bus.value.broadcast(buffered);

          for (const event of buffered) {
            const handlers = yield* bus.value.afterCommitHandlersFor(event._tag);
            for (const [index, handler] of handlers.entries()) {
              yield* run(handler(event)).pipe(
                Effect.catchCause((cause) =>
                  reportUnhandled({
                    // Handlers register as bare functions, so the position in the
                    // tag's registration order is the only name one has.
                    source: `${event._tag}#${index}`,
                    kind: "after-commit-handler",
                    eventTag: event._tag,
                    cause,
                  }),
                ),
                Effect.withSpan(`event.afterCommit.${event._tag}`),
              );
            }
          }
        });

      const runOutermost = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        Effect.gen(function* () {
          const postCommitEvents = yield* Ref.make<ReadonlyArray<Event.Base>>([]);
          // Sequencing is the commit guarantee: a failed scope never reaches the
          // flush, so events from work that was discarded never fire.
          const result = yield* driver.withTransaction(
            Effect.provideService(effect, UnitOfWorkScope, { postCommitEvents }),
          );
          yield* flushPostCommit(yield* Ref.get(postCommitEvents));
          return result;
        });

      const runNested = <A, E, R>(
        effect: Effect.Effect<A, E, R>,
        postCommitEvents: Ref.Ref<ReadonlyArray<Event.Base>>,
      ) =>
        Effect.gen(function* () {
          const lengthOnEntry = (yield* Ref.get(postCommitEvents)).length;
          return yield* driver
            .withSavepoint(Effect.provideService(effect, UnitOfWorkScope, { postCommitEvents }))
            .pipe(
              Effect.tapCause(() =>
                Ref.update(postCommitEvents, (buffered) => buffered.slice(0, lengthOnEntry)),
              ),
            );
        });

      const run = <A, E, R>(
        effect: Effect.Effect<A, E, R>,
      ): Effect.Effect<A, E | TransactionFailed | PersistenceUnavailable, R> =>
        Effect.gen(function* () {
          if (!(yield* driver.isActive)) return yield* runOutermost(effect);

          // Nested runs share the enclosing scope's buffer so the whole
          // operation flushes once, at the outermost commit. A host that opened
          // its own scope without going through this boundary has no buffer to
          // inherit; a throwaway keeps the branch total.
          const enclosing = yield* Effect.serviceOption(UnitOfWorkScope);
          const postCommitEvents = Option.isSome(enclosing)
            ? enclosing.value.postCommitEvents
            : yield* Ref.make<ReadonlyArray<Event.Base>>([]);

          return yield* runNested(effect, postCommitEvents);
        });

      return UnitOfWork.of({ run });
    }),
  );

/**
 * The boundary combinator a use case applies at the end of its pipe, so the
 * unit of work is declared once and visibly rather than buried in an inner
 * block that dispatched event handlers would silently join.
 *
 * Named for the pattern, deliberately not `transactional` — that would leak the
 * SQL implementation the abstraction exists to hide. It demotes
 * `TransactionFailed` in this one place, which is what keeps the error channel
 * as clean as the name: a use case sees only `PersistenceUnavailable`.
 */
export const withUnitOfWork = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(UnitOfWork, (uow) => uow.run(effect)).pipe(
    Effect.catchTag("TransactionFailed", (error) => Effect.die(error)),
  );
