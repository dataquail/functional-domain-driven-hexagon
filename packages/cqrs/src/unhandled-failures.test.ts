import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import * as Event from "./event.js";
import { EventBus, makeEventBus } from "./event-bus.js";
import { RecordingTransactionDriver } from "./internal/transaction-driver-fake.js";
import * as Saga from "./saga.js";
import {
  makeUnhandledFailures,
  type UnhandledFailure,
  UnhandledFailures,
} from "./unhandled-failures.js";
import { makeUnitOfWork, UnitOfWork } from "./unit-of-work.js";

const Reacted = Event.make("ReactedEvent", { value: Schema.String });

/** A unit of work and eventual bus over the in-memory driver. */
const cqrsRuntime = Layer.mergeAll(makeUnitOfWork(), makeEventBus()).pipe(
  Layer.provide(RecordingTransactionDriver),
);

/** Collects everything reported while `body` runs. */
const collectingFailures = <A, E, R>(body: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const reported = yield* Ref.make<ReadonlyArray<UnhandledFailure>>([]);
    const failures = yield* UnhandledFailures;
    const observed = yield* failures.stream;
    const collecting = yield* Effect.forkScoped(
      Stream.runForEach(observed, (failure) => Ref.update(reported, (prev) => [...prev, failure])),
    );

    yield* body;
    yield* Effect.yieldNow;
    yield* Fiber.interrupt(collecting);

    return yield* Ref.get(reported);
  }).pipe(Effect.scoped);

describe("UnhandledFailures", () => {
  // The producer already committed, so this failure reaches no caller. Before it
  // was reported anywhere but a log line, the only way to notice was to read logs.
  it.effect("reports a failing after-commit handler, naming the event", () =>
    Effect.gen(function* () {
      const runtime = cqrsRuntime;

      const reported = yield* collectingFailures(
        Effect.gen(function* () {
          const uow = yield* UnitOfWork;
          const bus = yield* EventBus;
          yield* bus.subscribeAfterCommit(Reacted, () => Effect.die("handler exploded"));
          yield* uow.run(bus.dispatch([Reacted.make({ value: "a" })]));
        }),
      ).pipe(Effect.provide(Layer.mergeAll(runtime, makeUnhandledFailures())));

      deepStrictEqual(
        reported.map((failure) => ({
          kind: failure.kind,
          eventTag: failure.eventTag,
          died: Cause.hasDies(failure.cause),
        })),
        [{ kind: "after-commit-handler", eventTag: "ReactedEvent", died: true }],
      );
    }),
  );

  it.effect("reports a saga that stops, naming it", () =>
    Effect.gen(function* () {
      const runtime = cqrsRuntime;
      const doomed = Saga.make({
        name: "DoomedSaga",
        events: [Reacted],
        run: (events) => Stream.runForEach(events, () => Effect.die("saga exploded")),
      });

      const reported = yield* collectingFailures(
        Effect.gen(function* () {
          const uow = yield* UnitOfWork;
          const bus = yield* EventBus;
          yield* uow.run(bus.dispatch([Reacted.make({ value: "a" })]));
          // Yield inside the runner's scope: closing it interrupts the saga fiber,
          // so the saga has to get its turn before this effect returns.
          yield* Effect.yieldNow;
        }).pipe(Effect.provide(Saga.runner(doomed))),
      ).pipe(Effect.provide(Layer.mergeAll(runtime, makeUnhandledFailures())));

      deepStrictEqual(
        reported.map((failure) => ({ kind: failure.kind, source: failure.source })),
        [{ kind: "saga", source: "DoomedSaga" }],
      );
    }),
  );

  // Shutting down interrupts every saga fiber. Reporting that would announce each
  // saga as broken on every clean stop — the noise that trains people to ignore
  // the channel entirely.
  it.effect("does not report a saga interrupted by shutdown", () =>
    Effect.gen(function* () {
      const runtime = cqrsRuntime;
      const idle = Saga.make({
        name: "IdleSaga",
        events: [Reacted],
        run: (events) => Stream.runForEach(events, () => Effect.void),
      });

      const reported = yield* collectingFailures(
        // Building and releasing the runner is the whole exercise: its scope
        // closes here, interrupting the saga.
        Effect.void.pipe(Effect.provide(Saga.runner(idle))),
      ).pipe(Effect.provide(Layer.mergeAll(runtime, makeUnhandledFailures())));

      deepStrictEqual(reported, []);
    }),
  );

  // Reporting is ambient and optional: a host that never wires it keeps exactly
  // the behaviour it had, which is what makes this additive rather than a change
  // to how failures are isolated.
  it.effect("isolates a handler failure just the same when nothing is wired", () =>
    Effect.gen(function* () {
      const runtime = cqrsRuntime;

      const handled = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* Effect.gen(function* () {
        const uow = yield* UnitOfWork;
        const bus = yield* EventBus;
        yield* bus.subscribeAfterCommit(Reacted, () => Effect.die("handler exploded"));
        yield* bus.subscribeAfterCommit(Reacted, (event) =>
          Ref.update(handled, (prev) => [...prev, event.value]),
        );

        // Succeeds despite the failing handler, and the later one still runs.
        yield* uow.run(bus.dispatch([Reacted.make({ value: "a" })]));
      }).pipe(Effect.provide(runtime));

      deepStrictEqual(yield* Ref.get(handled), ["a"]);
    }),
  );
});
