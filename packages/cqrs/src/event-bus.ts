import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import type * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import type * as Event from "./event.js";
import { UnitOfWorkScope } from "./unit-of-work-scope.js";

export type EventHandler = (event: Event.Base) => Effect.Effect<void>;

/**
 * One bus, three delivery contracts, chosen at **subscription** rather than at
 * dispatch.
 *
 * That is the whole design. A producer knows what happened; it does not know who
 * is listening, and in a layered application it is often forbidden to. Letting it
 * pick the consistency model would mean deciding, on behalf of consumers it
 * cannot name, whether their failure may undo its own write. So `dispatch` says
 * only "these events happened", and each subscriber declares what it needs — which
 * also lets one event serve an immediate consumer and an eventual one at once.
 */
export interface EventBusShape {
  /**
   * Publishes to every surface at once. Requires an open unit of work: absent one
   * the immediate subscribers would have no transaction to inherit and the
   * eventual ones would buffer onto nothing, so a missing scope is a defect
   * rather than a quietly different delivery.
   */
  readonly dispatch: (events: ReadonlyArray<Event.Base>) => Effect.Effect<void>;
  /**
   * Runs in the publisher's fiber, in registration order, inside its unit of
   * work: the handler's writes commit with the publisher's and its failure rolls
   * the publisher back.
   *
   * This is the contract for a reaction that is part of the same logical
   * operation — a wallet must not exist without its organization.
   */
  readonly subscribe: <S extends Event.Any>(
    event: S,
    handler: (event: Schema.Schema.Type<S>) => Effect.Effect<void>,
  ) => Effect.Effect<void>;
  /**
   * Runs after the outermost unit of work commits, each handler in a fresh unit
   * of work, its failure logged and isolated.
   *
   * The failure direction is the opposite of `subscribe`, by design: the producer
   * has already committed, so a reaction must not undo it. Handlers are therefore
   * expected to be idempotent and independently retryable.
   */
  readonly subscribeAfterCommit: <S extends Event.Any>(
    event: S,
    handler: (event: Schema.Schema.Type<S>) => Effect.Effect<void>,
  ) => Effect.Effect<void>;
  /**
   * Subscribes to the events of the given tags and hands back their stream. Only
   * events broadcast while subscribed arrive — nothing is replayed, and nothing
   * accumulates for a stream no one is reading.
   *
   * Subscribing is an effect rather than a property of the stream because *when*
   * it happens is observable: a consumer that subscribed lazily, on first pull,
   * would miss everything broadcast between its construction and that pull. The
   * subscription lives as long as the ambient scope.
   *
   * A third surface rather than a flag on `subscribeAfterCommit` because the
   * delivery contracts genuinely differ: an after-commit handler is awaited and
   * its failure isolated, while a stream consumer may be a process manager that
   * runs for days and must never hold up a flush.
   */
  readonly stream: (
    tags: ReadonlyArray<string>,
  ) => Effect.Effect<Stream.Stream<Event.Base>, never, Scope.Scope>;
  /** Read by the unit of work when it drains the buffer. */
  readonly afterCommitHandlersFor: (tag: string) => Effect.Effect<ReadonlyArray<EventHandler>>;
  /** The other half of what the unit of work calls when it flushes. */
  readonly broadcast: (events: ReadonlyArray<Event.Base>) => Effect.Effect<void>;
}

export class EventBus extends Context.Service<EventBus, EventBusShape>()("@org/cqrs/EventBus") {}

type Registry = ReadonlyMap<string, ReadonlyArray<EventHandler>>;

const register = (registry: Ref.Ref<Registry>, tag: string, handler: EventHandler) =>
  Ref.update(registry, (registered) => {
    const next = new Map(registered);
    next.set(tag, [...(registered.get(tag) ?? []), handler]);
    return next;
  });

/**
 * Builds the bus, optionally with per-event span-attribute extractors — pass the
 * merged contributions of every module that owns events.
 *
 * Subscriptions are registered while layers are built, so the registries are only
 * mutated during composition and are read-only by the time anything dispatches.
 */
export const makeEventBus = (
  options: { readonly spanAttributes?: Event.SpanAttributes } = {},
): Layer.Layer<EventBus> =>
  Layer.effect(
    EventBus,
    Effect.gen(function* () {
      const immediate = yield* Ref.make<Registry>(new Map());
      const afterCommit = yield* Ref.make<Registry>(new Map());
      const extractors = options.spanAttributes ?? {};
      // Unbounded so a broadcast never blocks the flush. A bounded buffer would
      // either block the publisher or drop silently; a consumer that stops
      // consuming shows up as its own subscription queue growing, which is a
      // diagnosable bug rather than lost events.
      const broadcasts = yield* PubSub.unbounded<Event.Base>();

      const subscribe: EventBusShape["subscribe"] = (event, handler) =>
        register(immediate, event.tag, handler as EventHandler);

      const subscribeAfterCommit: EventBusShape["subscribeAfterCommit"] = (event, handler) =>
        register(afterCommit, event.tag, handler as EventHandler);

      const dispatch: EventBusShape["dispatch"] = (events) =>
        Effect.gen(function* () {
          const scope = yield* Effect.serviceOption(UnitOfWorkScope);
          if (Option.isNone(scope)) {
            return yield* Effect.die(
              new Error(
                "EventBus.dispatch requires a unit of work: no UnitOfWorkScope in scope (did you forget withUnitOfWork?)",
              ),
            );
          }

          const registered = yield* Ref.get(immediate);
          for (const event of events) {
            const forTag = registered.get(event._tag) ?? [];
            const extractor = extractors[event._tag];
            // Routing by tag is what guarantees this extractor was written for
            // this event's type, which is what the `never` argument gives up.
            const extracted: Record<string, Event.SpanAttributeValue> =
              extractor !== undefined ? extractor(event as never) : {};

            yield* Effect.forEach(forTag, (handler) => handler(event), {
              discard: true,
            }).pipe(
              Effect.withSpan(`event.${event._tag}`, {
                attributes: {
                  "event.tag": event._tag,
                  "event.handler.count": forTag.length,
                  ...extracted,
                },
              }),
            );
          }

          // Buffered unconditionally, and only once the immediate handlers have
          // succeeded: their failure aborts the publisher, so there would be
          // nothing left to notify after a commit that is no longer going to
          // happen.
          yield* Ref.update(scope.value.postCommitEvents, (buffered) => [...buffered, ...events]);
        });

      const afterCommitHandlersFor: EventBusShape["afterCommitHandlersFor"] = (tag) =>
        Effect.map(Ref.get(afterCommit), (registered) => registered.get(tag) ?? []);

      const broadcast: EventBusShape["broadcast"] = (events) =>
        Effect.asVoid(PubSub.publishAll(broadcasts, events));

      const stream: EventBusShape["stream"] = (tags) => {
        const wanted = new Set(tags);
        return Effect.map(PubSub.subscribe(broadcasts), (subscription) =>
          Stream.filter(Stream.fromSubscription(subscription), (event) => wanted.has(event._tag)),
        );
      };

      return EventBus.of({
        afterCommitHandlersFor,
        broadcast,
        dispatch,
        stream,
        subscribe,
        subscribeAfterCommit,
      });
    }),
  );
