import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import * as Event from "./event.js";
import { EventBus, makeEventBus } from "./event-bus.js";
import { RecordingTransactionDriver } from "./internal/transaction-driver-fake.js";
import * as Saga from "./saga.js";
import { makeUnitOfWork, UnitOfWork } from "./unit-of-work.js";
import { UnitOfWorkScope } from "./unit-of-work-scope.js";

const OrderPlaced = Event.make("OrderPlaced", { orderId: Schema.String });
const PaymentCaptured = Event.make("PaymentCaptured", { orderId: Schema.String });

/** Where a saga under test records what it decided, in place of dispatching. */
class Shipments extends Context.Service<
  Shipments,
  { readonly ship: (orderId: string) => Effect.Effect<void> }
>()("test/Shipments") {}

/** A unit of work and eventual bus over the in-memory driver. */
const cqrsRuntime = Layer.mergeAll(makeUnitOfWork(), makeEventBus()).pipe(
  Layer.provide(RecordingTransactionDriver),
);

/** Commits a unit of work that dispatches the given events, then lets sagas run. */
const publish = (events: ReadonlyArray<{ readonly _tag: string }>) =>
  Effect.gen(function* () {
    const uow = yield* UnitOfWork;
    const bus = yield* EventBus;
    yield* uow.run(bus.dispatch(events));
    yield* Effect.yieldNow;
  });

describe("Saga", () => {
  // Correlation across two events is what a saga buys over a stateless event
  // adapter: neither event alone is enough to decide.
  it.effect("correlates two events before acting", () =>
    Effect.gen(function* () {
      const shipped = yield* Ref.make<ReadonlyArray<string>>([]);
      const runtime = cqrsRuntime;

      const fulfillment = Saga.make({
        name: "OrderFulfillment",
        events: [OrderPlaced, PaymentCaptured],
        run: (events) =>
          Effect.gen(function* () {
            const shipments = yield* Shipments;
            const seen = new Map<string, Set<string>>();
            yield* Stream.runForEach(events, (event) => {
              const forOrder = seen.get(event.orderId) ?? new Set<string>();
              forOrder.add(event._tag);
              seen.set(event.orderId, forOrder);
              return forOrder.has("OrderPlaced") && forOrder.has("PaymentCaptured")
                ? shipments.ship(event.orderId)
                : Effect.void;
            });
          }),
      });

      yield* Effect.gen(function* () {
        yield* publish([OrderPlaced.make({ orderId: "order-1" })]);
        deepStrictEqual(yield* Ref.get(shipped), []);

        yield* publish([PaymentCaptured.make({ orderId: "order-1" })]);
        deepStrictEqual(yield* Ref.get(shipped), ["order-1"]);
      }).pipe(
        Effect.provide(
          Saga.runner(fulfillment).pipe(
            Layer.provideMerge(runtime),
            Layer.provide(
              Layer.succeed(Shipments, {
                ship: (orderId) => Ref.update(shipped, (prev) => [...prev, orderId]),
              }),
            ),
          ),
        ),
      );
    }),
  );

  // The load-bearing safety property. The runner forks from the layer's scope, so
  // a saga's fiber cannot inherit a publisher's context — if it did, it would
  // issue queries on a connection about to commit and be released.
  it.effect("does not inherit the publishing unit of work's scope", () =>
    Effect.gen(function* () {
      const sawScope = yield* Ref.make<ReadonlyArray<boolean>>([]);
      const runtime = cqrsRuntime;

      const observer = Saga.make({
        name: "ScopeObserver",
        events: [OrderPlaced],
        run: (events) =>
          Stream.runForEach(events, () =>
            Effect.flatMap(Effect.serviceOption(UnitOfWorkScope), (scope) =>
              Ref.update(sawScope, (prev) => [...prev, Option.isSome(scope)]),
            ),
          ),
      });

      yield* publish([OrderPlaced.make({ orderId: "order-1" })]).pipe(
        Effect.provide(Saga.runner(observer).pipe(Layer.provideMerge(runtime))),
      );

      deepStrictEqual(yield* Ref.get(sawScope), [false]);
    }),
  );

  it.effect("a slow saga does not hold up the flush", () =>
    Effect.gen(function* () {
      const started = yield* Ref.make(false);
      const runtime = cqrsRuntime;

      const slow = Saga.make({
        name: "SlowSaga",
        events: [OrderPlaced],
        run: (events) =>
          Stream.runForEach(events, () => Effect.andThen(Ref.set(started, true), Effect.never)),
      });

      // Completing at all is the assertion: an awaited saga would hang here.
      yield* publish([OrderPlaced.make({ orderId: "order-1" })]).pipe(
        Effect.provide(Saga.runner(slow).pipe(Layer.provideMerge(runtime))),
      );

      deepStrictEqual(yield* Ref.get(started), true);
    }),
  );

  // One saga's bug must not silently stop the others, which is the failure mode a
  // shared consumer fiber would have.
  it.effect("a saga that dies leaves the others running", () =>
    Effect.gen(function* () {
      const survivor = yield* Ref.make<ReadonlyArray<string>>([]);
      const runtime = cqrsRuntime;

      const doomed = Saga.make({
        name: "Doomed",
        events: [OrderPlaced],
        run: (events) => Stream.runForEach(events, () => Effect.die("saga exploded")),
      });
      const healthy = Saga.make({
        name: "Healthy",
        events: [OrderPlaced],
        run: (events) =>
          Stream.runForEach(events, (event) =>
            Ref.update(survivor, (prev) => [...prev, event.orderId]),
          ),
      });

      yield* Effect.gen(function* () {
        yield* publish([OrderPlaced.make({ orderId: "order-1" })]);
        yield* publish([OrderPlaced.make({ orderId: "order-2" })]);
      }).pipe(Effect.provide(Saga.runner(doomed, healthy).pipe(Layer.provideMerge(runtime))));

      deepStrictEqual(yield* Ref.get(survivor), ["order-1", "order-2"]);
    }),
  );

  it.effect("each saga receives only the events it declared", () =>
    Effect.gen(function* () {
      const seen = yield* Ref.make<ReadonlyArray<string>>([]);
      const runtime = cqrsRuntime;

      const onPlaced = Saga.make({
        name: "OnPlaced",
        events: [OrderPlaced],
        run: (events) =>
          Stream.runForEach(events, (event) =>
            Ref.update(seen, (prev) => [...prev, `placed:${event._tag}`]),
          ),
      });
      const onCaptured = Saga.make({
        name: "OnCaptured",
        events: [PaymentCaptured],
        run: (events) =>
          Stream.runForEach(events, (event) =>
            Ref.update(seen, (prev) => [...prev, `captured:${event._tag}`]),
          ),
      });

      yield* publish([
        OrderPlaced.make({ orderId: "order-1" }),
        PaymentCaptured.make({ orderId: "order-1" }),
      ]).pipe(Effect.provide(Saga.runner(onPlaced, onCaptured).pipe(Layer.provideMerge(runtime))));

      deepStrictEqual([...(yield* Ref.get(seen))].sort(), [
        "captured:PaymentCaptured",
        "placed:OrderPlaced",
      ]);
    }),
  );

  it.effect("derives the tags it subscribes to from its events", () => {
    const saga = Saga.make({
      name: "OrderFulfillment",
      events: [OrderPlaced, PaymentCaptured],
      run: () => Effect.void,
    });

    deepStrictEqual(saga.name, "OrderFulfillment");
    deepStrictEqual(saga.tags, ["OrderPlaced", "PaymentCaptured"]);
    return Effect.void;
  });
});
