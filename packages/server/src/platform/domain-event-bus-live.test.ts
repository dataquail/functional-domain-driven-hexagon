import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { DomainEvent as makeDomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus-live.js";

const TestEvent = makeDomainEvent("TestDomainEvent", { value: Schema.String });

// A no-op TransactionContext: dispatch's guard only checks for its presence,
// and these subscribers never touch the DB, so the client is never used.
const fakeTx: Parameters<typeof Database.TransactionContext.provide>[0] = (fn) =>
  Effect.promise(() => fn(undefined as never));

describe("makeDomainEventBusLive dispatch guard", () => {
  it.effect("runs subscribers in-fiber when a TransactionContext is in scope", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      let ran = false;
      yield* bus.subscribe(TestEvent, () =>
        Effect.sync(() => {
          ran = true;
        }),
      );
      yield* bus
        .dispatch([TestEvent.make({ value: "a" })])
        .pipe(Database.TransactionContext.provide(fakeTx));
      deepStrictEqual(ran, true);
    }).pipe(Effect.provide(makeDomainEventBusLive())),
  );

  it.effect("dispatch with no TransactionContext in scope is a defect", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      yield* bus.subscribe(TestEvent, () => Effect.void);
      const exit = yield* Effect.exit(bus.dispatch([TestEvent.make({ value: "a" })]));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.isDie(exit.cause), true);
      }
    }).pipe(Effect.provide(makeDomainEventBusLive())),
  );
});
