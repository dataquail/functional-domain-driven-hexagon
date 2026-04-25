import { type SpanAttributeValue } from "@/platform/span-attributable.js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import type * as Schema from "effect/Schema";
import { type AnyDomainEventSchema, type DomainEvent } from "./domain-event.js";

export { DomainEvent } from "./domain-event.js";

// Synchronous in-fiber dispatch. Handlers run in the publisher's fiber, in
// registration order, and inherit the publisher's context — including
// `TransactionContext` from `TransactionRunner.run`. A handler failure
// propagates out of `dispatch`, which means the surrounding transaction
// rolls back. This trades async fan-out for immediate consistency between
// aggregates that participate in the same unit of work. For genuinely
// eventually-consistent integration events, build a separate outbox-backed
// mechanism — do not extend this bus.
type Handler = (event: DomainEvent) => Effect.Effect<void>;

export interface DomainEventBusShape {
  readonly dispatch: (events: ReadonlyArray<DomainEvent>) => Effect.Effect<void>;
  readonly subscribe: <S extends AnyDomainEventSchema>(
    event: S,
    handler: (event: Schema.Schema.Type<S>) => Effect.Effect<void>,
  ) => Effect.Effect<void>;
}

export class DomainEventBus extends Context.Tag("DomainEventBus")<
  DomainEventBus,
  DomainEventBusShape
>() {}

/**
 * Map from event tag to a span-attributes extractor. Built per-module
 * (alongside the module's event definitions) and merged at server-wiring
 * time, in the same way `commandHandlers` / `queryHandlers` are merged.
 * Plain data — same shape on the producer side, on the dispatcher side,
 * and (eventually) on an outbox worker that reads serialized rows.
 */
// `never` in argument position is the contravariant trick that lets the
// merged map accept extractors whose arguments are concrete event types
// (e.g. `(e: UserCreated) => ...`) — the runtime guarantees the lookup-by-
// tag matches the right extractor to the right event before invocation.
export type DomainEventSpanAttributes = Readonly<
  Record<string, (event: never) => Record<string, SpanAttributeValue>>
>;

/**
 * Type-checked factory for a module's contribution. The constraint uses
 * `never` in the function's argument position because function parameters
 * are contravariant — an extractor for a specific event (e.g.
 * `(e: UserCreated) => ...`) IS assignable to an extractor for `never`,
 * but is NOT assignable to one for the general `DomainEvent`. The
 * `bottom-type-as-arg` trick lets the factory accept any per-tag extractor
 * the user has typed against the concrete event in its own file.
 */
export const eventSpanAttributes = <
  const M extends Readonly<Record<string, (event: never) => Record<string, SpanAttributeValue>>>,
>(
  map: M,
): M => map;

/**
 * Builds the live `DomainEventBus` layer with an optional registry of
 * per-event span-attribute extractors. Pass the merged contributions of
 * every module that owns events; the bus calls each event's extractor at
 * dispatch time and merges the result into the bus-level span.
 */
export const makeDomainEventBusLive = (
  options: { readonly spanAttributes?: DomainEventSpanAttributes } = {},
): Layer.Layer<DomainEventBus> =>
  Layer.effect(
    DomainEventBus,
    Effect.gen(function* () {
      const handlers = yield* Ref.make<ReadonlyMap<string, ReadonlyArray<Handler>>>(new Map());
      const extractors = options.spanAttributes ?? {};

      const subscribe: DomainEventBusShape["subscribe"] = (event, handler) =>
        Ref.update(handlers, (m) => {
          const existing = m.get(event.tag) ?? [];
          const next = new Map(m);
          next.set(event.tag, [...existing, handler as Handler]);
          return next;
        });

      const dispatch: DomainEventBusShape["dispatch"] = (events) =>
        Effect.gen(function* () {
          const map = yield* Ref.get(handlers);
          for (const event of events) {
            const list = map.get(event._tag) ?? [];
            const extractor = extractors[event._tag];
            // The `never`-arg type on the registry is the contravariance
            // trick that lets it accept concrete-event extractors. The
            // runtime guarantee that `event._tag` selects an extractor for
            // exactly this event's type is what makes the cast safe here.
            const extra: Record<string, SpanAttributeValue> =
              extractor !== undefined ? extractor(event as never) : {};
            yield* Effect.gen(function* () {
              for (const handler of list) {
                yield* handler(event);
              }
            }).pipe(
              Effect.withSpan(`domainEvent:${event._tag}`, {
                attributes: {
                  "event.tag": event._tag,
                  "event.handler.count": list.length,
                  ...extra,
                },
              }),
            );
          }
        });

      return DomainEventBus.of({ dispatch, subscribe });
    }),
  );
