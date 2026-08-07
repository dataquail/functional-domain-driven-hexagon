import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import * as Event from "./event.js";
import { EventBus, makeEventBus } from "./event-bus.js";
import { driverFailingWith, makeRecordingDriver } from "./internal/transaction-driver-fake.js";
import { PersistenceUnavailable } from "./persistence-unavailable.js";
import { TransactionDriver, TransactionFailed } from "./transaction-driver.js";
import { makeUnitOfWork, UnitOfWork, withUnitOfWork } from "./unit-of-work.js";

class Probe extends Context.Service<Probe, { readonly value: string }>()("test/Probe") {}

describe("UnitOfWork", () => {
  it.effect("run resolves the value of the effect it wraps", () =>
    Effect.gen(function* () {
      const { driver } = yield* makeRecordingDriver;
      const uow = yield* Effect.provide(
        UnitOfWork,
        makeUnitOfWork().pipe(Layer.provide(Layer.succeed(TransactionDriver, driver))),
      );

      const result = yield* uow.run(Effect.succeed("committed"));

      deepStrictEqual(result, "committed");
    }),
  );

  it.effect("a bare run opens a scope; a run already inside one nests instead", () =>
    Effect.gen(function* () {
      const { driver, scopes } = yield* makeRecordingDriver;
      const uow = yield* Effect.provide(
        UnitOfWork,
        makeUnitOfWork().pipe(Layer.provide(Layer.succeed(TransactionDriver, driver))),
      );

      yield* uow.run(uow.run(Effect.void));

      deepStrictEqual(yield* scopes, ["transaction", "savepoint"]);
    }),
  );

  // The port promises callers an untouched requirement channel: a host's scope
  // handle is ambient, never a declared requirement, so there is nothing for the
  // boundary to discharge. Pinned because a host adapter whose internals *do*
  // name a scope service could otherwise narrow `R` and quietly change the
  // contract for every use case.
  it.effect("run leaves the requirement channel untouched", () =>
    Effect.gen(function* () {
      const { driver } = yield* makeRecordingDriver;
      const uow = yield* Effect.provide(
        UnitOfWork,
        makeUnitOfWork().pipe(Layer.provide(Layer.succeed(TransactionDriver, driver))),
      );

      const needsService: Effect.Effect<string, never, Probe> = Effect.map(
        Probe,
        (probe) => probe.value,
      );
      // The annotation is the assertion: had `run` narrowed `R`, this would not
      // compile, and had it widened the error channel, the `never` would fail.
      const wrapped: Effect.Effect<string, TransactionFailed | PersistenceUnavailable, Probe> =
        uow.run(needsService);

      deepStrictEqual(
        yield* wrapped.pipe(Effect.provideService(Probe, { value: "still required" })),
        "still required",
      );
    }),
  );

  // The boundary failing is not something a use case can act on, so it must not
  // reach one as a typed error it would be forced to handle.
  it.effect("withUnitOfWork demotes a failed boundary to a defect", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(withUnitOfWork(Effect.void));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.hasDies(exit.cause), true);
      }
    }).pipe(
      Effect.provide(
        makeUnitOfWork().pipe(
          Layer.provide(driverFailingWith(new TransactionFailed({ message: "commit rejected" }))),
        ),
      ),
    ),
  );

  // The transient case is the opposite: a caller can act on it, and a transport
  // boundary turns it into a 503, so it stays a typed failure.
  it.effect("withUnitOfWork surfaces an unavailable store as a typed failure", () =>
    Effect.gen(function* () {
      const caught = yield* withUnitOfWork(Effect.void).pipe(
        Effect.catchTag("PersistenceUnavailable", (error) => Effect.succeed(error.message)),
      );

      deepStrictEqual(caught, "connection lost");
    }).pipe(
      Effect.provide(
        makeUnitOfWork().pipe(
          Layer.provide(
            driverFailingWith(new PersistenceUnavailable({ message: "connection lost" })),
          ),
        ),
      ),
    ),
  );
});

const Buffered = Event.make("BufferedEvent", { value: Schema.String });

/** Wires a real eventual bus alongside the unit of work over a recording driver. */
const stagedUnitOfWork = Effect.gen(function* () {
  const { driver, scopes } = yield* makeRecordingDriver;
  // Captured as one context so the unit of work's flush and the test body share
  // the same bus instance — a second instance would have no subscribers.
  const context = yield* Effect.context<UnitOfWork | EventBus>().pipe(
    Effect.provide(
      Layer.mergeAll(makeUnitOfWork(), makeEventBus()).pipe(
        Layer.provide(Layer.succeed(TransactionDriver, driver)),
      ),
    ),
  );
  return {
    scopes,
    uow: Context.get(context, UnitOfWork),
    bus: Context.get(context, EventBus),
    provide: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, context),
  };
});

describe("UnitOfWork post-commit flush", () => {
  it.effect("drains an eventual event after the scope that produced it completes", () =>
    Effect.gen(function* () {
      const { bus, provide, uow } = yield* stagedUnitOfWork;
      const handled = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* bus.subscribeAfterCommit(Buffered, (event) =>
        Ref.update(handled, (prev) => [...prev, event.value]),
      );

      yield* provide(
        uow.run(
          Effect.gen(function* () {
            // Nothing has run yet at this point — that is the whole contract.
            yield* bus.dispatch([Buffered.make({ value: "a" })]);
            deepStrictEqual(yield* Ref.get(handled), []);
          }),
        ),
      );

      deepStrictEqual(yield* Ref.get(handled), ["a"]);
    }),
  );

  it.effect("discards buffered events when the producing scope fails", () =>
    Effect.gen(function* () {
      const { bus, provide, uow } = yield* stagedUnitOfWork;
      const handled = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* bus.subscribeAfterCommit(Buffered, (event) =>
        Ref.update(handled, (prev) => [...prev, event.value]),
      );

      yield* Effect.exit(
        provide(
          uow.run(
            Effect.andThen(bus.dispatch([Buffered.make({ value: "a" })]), Effect.fail("rollback")),
          ),
        ),
      );

      deepStrictEqual(yield* Ref.get(handled), []);
    }),
  );

  // The savepoint-discard rule: a nested scope that rolled back must not leave
  // its events behind for the outer commit to flush, while the outer scope's own
  // events still fire.
  it.effect("a failed nested scope discards only its own buffered events", () =>
    Effect.gen(function* () {
      const { bus, provide, uow } = yield* stagedUnitOfWork;
      const handled = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* bus.subscribeAfterCommit(Buffered, (event) =>
        Ref.update(handled, (prev) => [...prev, event.value]),
      );

      yield* provide(
        uow.run(
          Effect.gen(function* () {
            yield* bus.dispatch([Buffered.make({ value: "outer" })]);
            yield* Effect.ignore(
              uow.run(
                Effect.andThen(
                  bus.dispatch([Buffered.make({ value: "nested" })]),
                  Effect.fail("nested rollback"),
                ),
              ),
            );
          }),
        ),
      );

      deepStrictEqual(yield* Ref.get(handled), ["outer"]);
    }),
  );

  // The producer already committed, so a reaction failing must not be able to
  // surface as the producer's failure.
  it.effect("isolates a failing handler from the producer", () =>
    Effect.gen(function* () {
      const { bus, provide, uow } = yield* stagedUnitOfWork;
      const handled = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* bus.subscribeAfterCommit(Buffered, () => Effect.die("handler exploded"));
      yield* bus.subscribeAfterCommit(Buffered, (event) =>
        Ref.update(handled, (prev) => [...prev, event.value]),
      );

      const exit = yield* Effect.exit(
        provide(uow.run(bus.dispatch([Buffered.make({ value: "a" })]))),
      );

      deepStrictEqual(Exit.isSuccess(exit), true);
      deepStrictEqual(yield* Ref.get(handled), ["a"]);
    }),
  );

  // What the single bus buys: the producer says only that something happened, and
  // two consumers of the *same* event get the consistency each of them needs.
  it.effect(
    "delivers one event to an immediate and an after-commit subscriber, in that order",
    () =>
      Effect.gen(function* () {
        const { bus, provide, uow } = yield* stagedUnitOfWork;
        const ran = yield* Ref.make<ReadonlyArray<string>>([]);
        yield* bus.subscribe(Buffered, () => Ref.update(ran, (prev) => [...prev, "immediate"]));
        yield* bus.subscribeAfterCommit(Buffered, () =>
          Ref.update(ran, (prev) => [...prev, "afterCommit"]),
        );

        yield* provide(
          uow.run(
            Effect.gen(function* () {
              yield* bus.dispatch([Buffered.make({ value: "a" })]);
              // Still inside the scope: the immediate one has run, the other has not.
              deepStrictEqual(yield* Ref.get(ran), ["immediate"]);
            }),
          ),
        );

        deepStrictEqual(yield* Ref.get(ran), ["immediate", "afterCommit"]);
      }),
  );

  // The two surfaces are opposites on failure, and the whole point is that a
  // publisher no longer chooses which one its consumers get.
  it.effect("an after-commit failure spares the producer where an immediate one fails it", () =>
    Effect.gen(function* () {
      const staged = yield* stagedUnitOfWork;
      yield* staged.bus.subscribeAfterCommit(Buffered, () => Effect.die("reaction exploded"));
      const afterCommitOnly = yield* Effect.exit(
        staged.provide(staged.uow.run(staged.bus.dispatch([Buffered.make({ value: "a" })]))),
      );

      const withImmediate = yield* stagedUnitOfWork;
      yield* withImmediate.bus.subscribe(Buffered, () => Effect.die("reaction exploded"));
      const alsoImmediate = yield* Effect.exit(
        withImmediate.provide(
          withImmediate.uow.run(withImmediate.bus.dispatch([Buffered.make({ value: "a" })])),
        ),
      );

      deepStrictEqual(Exit.isSuccess(afterCommitOnly), true);
      deepStrictEqual(Exit.isFailure(alsoImmediate), true);
    }),
  );
});
