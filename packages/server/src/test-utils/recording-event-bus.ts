import { DomainEventBus, type DomainEvent } from "@/platform/domain-event-bus.js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

// Test double for `DomainEventBus`: records every dispatched event and
// ignores `subscribe` calls. Use-case unit tests assert against the
// recorded log without needing the real subscribers wired up. Integration
// tests that need real subscribers use `DomainEventBusLive` instead.
export class RecordedEvents extends Context.Tag("RecordedEvents")<
  RecordedEvents,
  {
    readonly all: Effect.Effect<ReadonlyArray<DomainEvent>>;
    readonly byTag: <E extends DomainEvent>(tag: E["_tag"]) => Effect.Effect<ReadonlyArray<E>>;
  }
>() {}

export const RecordingEventBus: Layer.Layer<DomainEventBus | RecordedEvents> = Layer.effectContext(
  Effect.gen(function* () {
    const published = yield* Ref.make<ReadonlyArray<DomainEvent>>([]);

    return Context.empty().pipe(
      Context.add(
        DomainEventBus,
        DomainEventBus.of({
          dispatch: (events) => Ref.update(published, (prev) => [...prev, ...events]),
          subscribe: () => Effect.void,
        }),
      ),
      Context.add(RecordedEvents, {
        all: Ref.get(published),
        byTag: <E extends DomainEvent>(tag: E["_tag"]) =>
          Effect.map(
            Ref.get(published),
            (events) => events.filter((e) => e._tag === tag) as unknown as ReadonlyArray<E>,
          ),
      }),
    );
  }),
);
