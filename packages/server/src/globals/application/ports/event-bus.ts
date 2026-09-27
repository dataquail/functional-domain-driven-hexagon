// `@effect-server-utils/cqrs` is a generic library, so it names the bus for what it does. This
// application does DDD, so it names it for what it carries.
//
// It sits in `ports/` rather than in `ddd/`, and that placement is the
// enforcement: `domain-isolation` admits `globals/application/ddd/` and nothing
// else, so a domain port structurally cannot name a bus in its requirement
// channel (ADR-0006). The event *type* lives in `ddd/domain-event.ts`, which
// the domain may reach.
export {
  EventBus as DomainEventBus,
  type EventBusShape as DomainEventBusShape,
} from "@effect-server-utils/cqrs";
