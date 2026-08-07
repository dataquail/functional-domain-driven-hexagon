// `@org/cqrs` is a generic library, so it names the bus for what it does. This
// application does DDD, so it names it for what it carries.
//
// It sits beside `contracts/` rather than inside it, and that placement is the
// enforcement: `domain-isolation` admits the contracts tier and nothing else under
// `platform/ddd/`, so a domain port structurally cannot name a bus in its
// requirement channel (ADR-0006). The event *type* lives in
// `contracts/domain-event.ts`, which the domain may reach.
export { EventBus as DomainEventBus, type EventBusShape as DomainEventBusShape } from "@org/cqrs";
