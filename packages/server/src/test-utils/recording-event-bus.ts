import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { type DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";

// Test double for `DomainEventBus`: records every dispatched event and ignores
// every registration, whichever surface it came in on. A use-case unit test
// asserts what its subject *published*; what anyone does in response is that
// subscriber's own test. A test that needs real subscribers wires the real bus.
export class RecordedEvents extends Context.Service<
  RecordedEvents,
  {
    readonly all: Effect.Effect<ReadonlyArray<DomainEvent>>;
    readonly byTag: <E extends DomainEvent>(tag: E["_tag"]) => Effect.Effect<ReadonlyArray<E>>;
  }
>()("RecordedEvents") {}

export const RecordingEventBus: Layer.Layer<DomainEventBus | RecordedEvents> = Layer.effectContext(
  Effect.gen(function* () {
    const published = yield* Ref.make<ReadonlyArray<DomainEvent>>([]);

    return Context.empty().pipe(
      Context.add(
        DomainEventBus,
        DomainEventBus.of({
          dispatch: (events) => Ref.update(published, (prev) => [...prev, ...events]),
          subscribe: () => Effect.void,
          subscribeAfterCommit: () => Effect.void,
          drain: () => Effect.void,
          broadcast: () => Effect.void,
          stream: () => Effect.succeed(Stream.empty),
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
