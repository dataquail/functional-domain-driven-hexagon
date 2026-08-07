import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Stream from "effect/Stream";

import type * as Event from "./event.js";
import { EventBus } from "./event-bus.js";
import { reportUnhandled } from "./unhandled-failures.js";

/**
 * A long-running process manager: it watches eventual events over time and
 * decides what to do when a *combination* of them has arrived.
 *
 * This is the shape a stateless event adapter cannot express. An adapter
 * translates one event into one command; a saga correlates several, waits for one
 * that may never come, and compensates when a later step fails. Reach for an
 * adapter first — a saga is the answer only when no single event is enough to
 * decide.
 *
 * A saga never runs inside the transaction of whatever published its events, and
 * cannot: the runner forks it from its own layer's scope, so a publisher's
 * context is not in its ancestry. Each command a saga dispatches therefore opens
 * its own unit of work. That is not a limitation being worked around — it is the
 * pattern. Holding one transaction open across a process that waits for a payment
 * is the thing sagas exist to avoid, which is why they trade atomicity for
 * compensation.
 *
 * **Delivery is in-memory and lossy across a restart.** A saga's state lives in
 * the fiber running it, and its events arrive over a subscription with no replay,
 * so a process death loses whatever was in flight. That is the same durability
 * boundary the eventual bus already has; a durable event log fixes both at once.
 * Until then, keep a saga's decisions idempotent.
 */
export interface Saga<R> {
  readonly name: string;
  readonly tags: ReadonlyArray<string>;
  /**
   * `never` in argument position is the contravariance trick the span-attribute
   * registries also use: it lets this hold a `run` written against a stream of
   * that saga's own concrete events, which a `DomainEvent` argument would reject.
   */
  readonly run: (events: Stream.Stream<never>) => Effect.Effect<void, never, R>;
}

/** Erased `Saga`, for constraints. `unknown` accepts any requirement, since `R` is covariant here. */
export type Any = Saga<unknown>;

export type Services<S> = S extends Saga<infer R> ? R : never;

/**
 * Declares a saga. `events` are the tags it watches; `run` receives them as a
 * stream, typed as the union of exactly those events.
 *
 * `run` must not fail. A process manager that can end in an unhandled error has
 * no one to report to — the producer committed long ago — so the compensating
 * action is part of the saga's job and the empty error channel is what forces
 * that decision to be made rather than deferred.
 */
export const make = <const Events extends ReadonlyArray<Event.Any>, R>(definition: {
  readonly name: string;
  readonly events: Events;
  readonly run: (
    events: Stream.Stream<Event.Type<Events[number]>>,
  ) => Effect.Effect<void, never, R>;
}): Saga<R> => ({
  name: definition.name,
  tags: definition.events.map((event) => event.tag),
  run: definition.run,
});

/**
 * Runs sagas for as long as the layer lives.
 *
 * Each saga is forked from *this layer's* scope rather than from whatever fiber
 * happens to publish an event. That is what makes transaction inheritance
 * impossible instead of merely discouraged: the fiber's context is the one the
 * layer was built with, which holds no publisher's scope to inherit. Nothing has
 * to be scrubbed, so nothing can be forgotten.
 *
 * A saga that dies takes only itself down and is reported to `UnhandledFailures`
 * — one saga's bug must not silently stop the others.
 *
 * Interruption is not reported. Every saga fiber is interrupted when this layer's
 * scope closes, so treating that as a failure would announce each saga as broken
 * on every clean shutdown, which is exactly the noise that trains people to ignore
 * the channel.
 */
export const runner = <const Sagas extends ReadonlyArray<Any>>(
  ...sagas: Sagas
): Layer.Layer<never, never, EventBus | Services<Sagas[number]>> =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const bus = yield* EventBus;

      for (const saga of sagas) {
        // Subscribed here, before the layer finishes building, so a saga cannot
        // miss an event published by the first unit of work to commit after boot.
        const events = (yield* bus.stream(saga.tags)) as Stream.Stream<never>;
        yield* Effect.forkScoped(
          saga.run(events).pipe(
            Effect.catchCause((cause) =>
              Cause.hasInterruptsOnly(cause)
                ? Effect.void
                : reportUnhandled({
                    source: saga.name,
                    kind: "saga",
                    eventTag: undefined,
                    cause,
                  }),
            ),
            Effect.withSpan(`saga.${saga.name}`),
          ),
        );
      }
    }),
  ) as Layer.Layer<never, never, EventBus | Services<Sagas[number]>>;
