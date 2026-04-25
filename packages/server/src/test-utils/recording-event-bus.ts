import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { DomainEventBus, type DomainEvent } from "../platform/domain-event-bus.js";

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
          publishAll: (events: ReadonlyArray<DomainEvent>) =>
            Ref.update(published, (prev) => [...prev, ...events]),
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
