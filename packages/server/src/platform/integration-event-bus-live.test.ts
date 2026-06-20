import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import {
  type DomainEvent,
  DomainEvent as makeDomainEvent,
} from "@/platform/ddd/contracts/domain-event.js";
import { PostCommitBuffer } from "@/platform/ddd/contracts/post-commit-buffer.js";
import { IntegrationEventBus } from "@/platform/ddd/ports/integration-event-bus.js";
import { makeIntegrationEventBusLive } from "@/platform/integration-event-bus-live.js";

const TestEvent = makeDomainEvent("TestIntegrationEvent", { value: Schema.String });

describe("IntegrationEventBusLive", () => {
  it.effect("dispatch appends to the ambient PostCommitBuffer and does NOT run handlers", () =>
    Effect.gen(function* () {
      const bus = yield* IntegrationEventBus;
      const buffer = yield* Ref.make<ReadonlyArray<DomainEvent>>([]);
      let handlerRan = false;
      yield* bus.subscribe(TestEvent, () =>
        Effect.sync(() => {
          handlerRan = true;
        }),
      );

      yield* bus
        .dispatch([TestEvent.make({ value: "a" })])
        .pipe(Effect.provideService(PostCommitBuffer, buffer));

      const buffered = yield* Ref.get(buffer);
      deepStrictEqual(buffered.length, 1);
      // dispatch only buffers — the unit of work runs handlers post-commit.
      deepStrictEqual(handlerRan, false);
    }).pipe(Effect.provide(makeIntegrationEventBusLive())),
  );

  it.effect("handlersFor returns the handlers registered for a tag", () =>
    Effect.gen(function* () {
      const bus = yield* IntegrationEventBus;
      yield* bus.subscribe(TestEvent, () => Effect.void);
      yield* bus.subscribe(TestEvent, () => Effect.void);
      const handlers = yield* bus.handlersFor("TestIntegrationEvent");
      deepStrictEqual(handlers.length, 2);
      const none = yield* bus.handlersFor("UnknownEvent");
      deepStrictEqual(none.length, 0);
    }).pipe(Effect.provide(makeIntegrationEventBusLive())),
  );

  it.effect("dispatch with no PostCommitBuffer in scope is a defect", () =>
    Effect.gen(function* () {
      const bus = yield* IntegrationEventBus;
      const exit = yield* Effect.exit(bus.dispatch([TestEvent.make({ value: "a" })]));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.isDie(exit.cause), true);
      }
    }).pipe(Effect.provide(makeIntegrationEventBusLive())),
  );
});
