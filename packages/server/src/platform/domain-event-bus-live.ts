import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { type DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributeValue } from "@/platform/ddd/contracts/span-attributable.js";
import {
  DomainEventBus,
  type DomainEventBusShape,
  type DomainEventSpanAttributes,
} from "@/platform/ddd/ports/domain-event-bus.js";

type Handler = (event: DomainEvent) => Effect.Effect<void>;

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
