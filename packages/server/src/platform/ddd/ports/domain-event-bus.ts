import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Schema from "effect/Schema";

import {
  type AnyDomainEventSchema,
  type DomainEvent,
} from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributeValue } from "@/platform/ddd/contracts/span-attributable.js";

export { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";

// Port for synchronous in-fiber domain-event dispatch. Handlers run in
// the publisher's fiber, in registration order, and inherit the
// publisher's context — including `TransactionContext` from
// `UnitOfWork.run`. A handler failure propagates out of `dispatch`, which
// means the surrounding unit of work rolls back. This trades async fan-out
// for immediate consistency between aggregates that participate in the
// same unit of work. For genuinely eventually-consistent integration
// events, build a separate outbox-backed mechanism — do not extend this
// bus (ADR-0007).
//
// The live implementation (`makeDomainEventBusLive` in
// `platform/domain-event-bus-live.ts`) is wired only at the composition
// root.
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
