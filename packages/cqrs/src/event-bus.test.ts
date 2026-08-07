import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import * as Event from "./event.js";
import { EventBus, makeEventBus } from "./event-bus.js";
import { UnitOfWorkScope } from "./unit-of-work-scope.js";

const TestEvent = Event.make("TestEvent", { value: Schema.String });
const OtherEvent = Event.make("OtherEvent", { value: Schema.String });

/** Stands in for the scope the unit of work would have opened. */
const inUnitOfWork = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(Ref.make<ReadonlyArray<Event.Base>>([]), (postCommitEvents) =>
    Effect.provideService(effect, UnitOfWorkScope, { postCommitEvents }),
  );

describe("EventBus.subscribe (immediate)", () => {
  it.effect("runs a subscriber in the publisher's fiber", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;
      let ran = false;
      yield* bus.subscribe(TestEvent, () =>
        Effect.sync(() => {
          ran = true;
        }),
      );

      yield* inUnitOfWork(bus.dispatch([TestEvent.make({ value: "a" })]));

      deepStrictEqual(ran, true);
    }).pipe(Effect.provide(makeEventBus())),
  );

  it.effect("runs every subscriber for a tag, in registration order", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;
      const order = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* bus.subscribe(TestEvent, () => Ref.update(order, (prev) => [...prev, "first"]));
      yield* bus.subscribe(TestEvent, () => Ref.update(order, (prev) => [...prev, "second"]));

      yield* inUnitOfWork(bus.dispatch([TestEvent.make({ value: "a" })]));

      deepStrictEqual(yield* Ref.get(order), ["first", "second"]);
    }).pipe(Effect.provide(makeEventBus())),
  );

  // The failure direction that distinguishes this surface from the after-commit
  // one: a subscriber's failure must reach the publisher so its unit of work
  // rolls back.
  it.effect("propagates a subscriber's failure to the publisher", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;
      yield* bus.subscribe(TestEvent, () => Effect.die("subscriber exploded"));

      const exit = yield* Effect.exit(inUnitOfWork(bus.dispatch([TestEvent.make({ value: "a" })])));

      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(makeEventBus())),
  );
});

describe("EventBus.subscribeAfterCommit", () => {
  // The distinguishing behaviour: dispatch does not run these. The unit of work
  // drains the buffer after it commits, which is what keeps a reaction from being
  // able to undo its trigger.
  it.effect("dispatch buffers onto the unit of work's scope and runs no handler", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;
      const postCommitEvents = yield* Ref.make<ReadonlyArray<Event.Base>>([]);
      let ran = false;
      yield* bus.subscribeAfterCommit(TestEvent, () =>
        Effect.sync(() => {
          ran = true;
        }),
      );

      yield* bus
        .dispatch([TestEvent.make({ value: "a" })])
        .pipe(Effect.provideService(UnitOfWorkScope, { postCommitEvents }));

      deepStrictEqual((yield* Ref.get(postCommitEvents)).length, 1);
      deepStrictEqual(ran, false);
    }).pipe(Effect.provide(makeEventBus())),
  );

  it.effect("afterCommitHandlersFor returns every handler registered for a tag", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;
      yield* bus.subscribeAfterCommit(TestEvent, () => Effect.void);
      yield* bus.subscribeAfterCommit(TestEvent, () => Effect.void);

      deepStrictEqual((yield* bus.afterCommitHandlersFor("TestEvent")).length, 2);
      deepStrictEqual((yield* bus.afterCommitHandlersFor("UnknownEvent")).length, 0);
    }).pipe(Effect.provide(makeEventBus())),
  );

  // The capability the merge exists for. Under two buses a producer picked one
  // consistency model for every consumer; here one dispatch serves a reaction that
  // must be atomic with it and one that must not be.
  it.effect("one dispatch serves an immediate and an after-commit subscriber at once", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;
      const postCommitEvents = yield* Ref.make<ReadonlyArray<Event.Base>>([]);
      const ran = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* bus.subscribe(TestEvent, () => Ref.update(ran, (prev) => [...prev, "immediate"]));
      yield* bus.subscribeAfterCommit(TestEvent, () =>
        Ref.update(ran, (prev) => [...prev, "afterCommit"]),
      );

      yield* bus
        .dispatch([TestEvent.make({ value: "a" })])
        .pipe(Effect.provideService(UnitOfWorkScope, { postCommitEvents }));

      // Only the immediate one has run; the other is buffered for the flush.
      deepStrictEqual(yield* Ref.get(ran), ["immediate"]);
      deepStrictEqual((yield* Ref.get(postCommitEvents)).length, 1);
      deepStrictEqual((yield* bus.afterCommitHandlersFor(TestEvent.tag)).length, 1);
    }).pipe(Effect.provide(makeEventBus())),
  );
});

describe("EventBus.stream", () => {
  // The saga seam. `subscribeAfterCommit` handlers are awaited and isolated by the
  // unit of work; a stream is published to and not awaited, because a process
  // manager may run for days and must never hold up the flush.
  it.effect("emits broadcast events, filtered to the requested tags", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;
      const collected = yield* Ref.make<ReadonlyArray<string>>([]);

      const events = yield* bus.stream([TestEvent.tag]);
      const consuming = yield* Effect.forkScoped(
        Stream.runForEach(events, (event) =>
          Ref.update(collected, (prev) => [...prev, event._tag]),
        ),
      );

      yield* bus.broadcast([
        TestEvent.make({ value: "a" }),
        OtherEvent.make({ value: "b" }),
        TestEvent.make({ value: "c" }),
      ]);
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(consuming);

      deepStrictEqual(yield* Ref.get(collected), ["TestEvent", "TestEvent"]);
    }).pipe(Effect.scoped, Effect.provide(makeEventBus())),
  );

  // A stream with no consumer must not accumulate, or a bus in a process with no
  // sagas would grow without bound.
  it.effect("broadcast with no consumer completes and retains nothing", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;

      yield* bus.broadcast([TestEvent.make({ value: "a" })]);

      const collected = yield* Ref.make<ReadonlyArray<string>>([]);
      const events = yield* bus.stream([TestEvent.tag]);
      const consuming = yield* Effect.forkScoped(
        Stream.runForEach(events, (event) =>
          Ref.update(collected, (prev) => [...prev, event._tag]),
        ),
      );
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(consuming);

      deepStrictEqual(yield* Ref.get(collected), []);
    }).pipe(Effect.scoped, Effect.provide(makeEventBus())),
  );
});

describe("EventBus.dispatch", () => {
  // Absent a scope the immediate subscribers would have no transaction to inherit
  // and the after-commit ones would buffer onto nothing, vanishing silently —
  // worse than failing.
  it.effect("dispatching outside a unit of work is a defect", () =>
    Effect.gen(function* () {
      const bus = yield* EventBus;
      yield* bus.subscribe(TestEvent, () => Effect.void);

      const exit = yield* Effect.exit(bus.dispatch([TestEvent.make({ value: "a" })]));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.hasDies(exit.cause), true);
      }
    }).pipe(Effect.provide(makeEventBus())),
  );
});
