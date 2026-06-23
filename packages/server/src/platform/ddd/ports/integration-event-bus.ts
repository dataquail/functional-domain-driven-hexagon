import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Schema from "effect/Schema";

import {
  type AnyDomainEventSchema,
  type DomainEvent,
} from "@/platform/ddd/contracts/domain-event.js";

export { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";

// Port for eventual-consistency, post-commit domain-event dispatch — the
// second bus (ADR-0007). It carries the SAME `DomainEvent` base as the
// in-fiber `DomainEventBus`; the bus a producer publishes to is the switch
// between consistency models, not a distinct event type.
//
// `dispatch` does NOT run handlers. It appends the events to the ambient
// `PostCommitBuffer` (provided by the outermost `UnitOfWork.run`), and the
// unit of work drains the buffer AFTER it commits — each handler in its own
// fresh transaction, its failure logged and isolated so it can never roll
// back the already-committed producer. Dispatching with no buffer in scope is
// a defect: integration events presume a unit of work (the safety net for a
// forgotten `withUnitOfWork`).
//
// `handlersFor` is the accessor the unit-of-work flush uses to look up the
// post-commit handlers for a buffered event's tag. Subscribers register
// effects that already have their dependencies provided (R = never), exactly
// like the in-fiber bus, so the flush can run them against a bare transaction.
//
// The live implementation (`makeIntegrationEventBusLive` in
// `platform/integration-event-bus-live.ts`) is wired only at the composition
// root.
export interface IntegrationEventBusShape {
  readonly dispatch: (events: ReadonlyArray<DomainEvent>) => Effect.Effect<void>;
  readonly subscribe: <S extends AnyDomainEventSchema>(
    event: S,
    handler: (event: Schema.Schema.Type<S>) => Effect.Effect<void>,
  ) => Effect.Effect<void>;
  readonly handlersFor: (
    tag: string,
  ) => Effect.Effect<ReadonlyArray<(event: DomainEvent) => Effect.Effect<void>>>;
}

export class IntegrationEventBus extends Context.Tag("IntegrationEventBus")<
  IntegrationEventBus,
  IntegrationEventBusShape
>() {}
