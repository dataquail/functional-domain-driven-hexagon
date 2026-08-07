// `./testing.js` is deliberately absent from this barrel and from the generated
// index: its serializability checks derive sample values with `fast-check`, a real
// runtime import that has no business in a consumer's production process. Reach it
// at `@org/cqrs/testing`, from a test.

// Declaring and handling messages: `Command.make`, `Command.group`, `Command.handlersOf`,
// and `Command.dispatcher` — a module's own dispatch surface, one method per tag it owns.
export * as Command from "./command.js";
export * as Query from "./query.js";

// Declaring an event: `Event.make`, the `Event.Base` a bus routes on, plus the
// per-event span-attribute registry a module contributes. The third message kind,
// and the one that fans out — many handlers may answer one event, where a command
// and a query each have exactly one.
export * as Event from "./event.js";

// A long-running process manager over after-commit events: `Saga.make` declares one,
// `Saga.runner` runs them for the life of its layer. Reach for an inbound event
// adapter first — a saga earns its state only when no single event decides.
export * as Saga from "./saga.js";

// Behaviour applied once around every dispatch instead of at each call site:
// `Middleware.span` (installed by default) and `Middleware.metrics`. A middleware
// may not change a message's success or error channels — that constraint is what
// lets the bus have a seam without weakening the types a caller reads off the
// message definition.
export * as Middleware from "./middleware.js";

// Where a failure goes when no caller is left to receive it: an eventual event
// handler or a saga, both of which run after their producer committed. Optional —
// absent it, those failures are logged exactly as before.
export {
  makeUnhandledFailures,
  type UnhandledFailure,
  type UnhandledFailureKind,
  UnhandledFailures,
  type UnhandledFailuresShape,
} from "./unhandled-failures.js";

// The application-wide buses a caller dispatches through, plus the routing table that
// composes per-module dispatchers into one. The Tags and their shapes are what ordinary
// code depends on; `makeCommandBus` / `makeQueryBus` / `mergeDispatchTables` take the
// whole table and belong only where an application is composed.
// The three ways a routing table can be wrong travel as tagged defects, so a
// host's boot check — or a test — can name the condition rather than match a
// message string.
export { CommandBus, type CommandBusShape, makeCommandBus } from "./command-bus.js";
export {
  type DispatchTable,
  DuplicateDispatchTag,
  mergeDispatchTables,
  MissingHandler,
  UnroutableTags,
} from "./dispatch-table.js";
export { makeQueryBus, QueryBus, type QueryBusShape } from "./query-bus.js";

// The atomicity boundary a write-side use case declares once, at the end of its pipe.
// A host supplies `TransactionDriver`; everything about how the boundary behaves —
// re-entrancy, and the event semantics layered on it — belongs to this package.
export { PersistenceUnavailable } from "./persistence-unavailable.js";
export {
  TransactionDriver,
  type TransactionDriverShape,
  TransactionFailed,
} from "./transaction-driver.js";
export {
  makeUnitOfWork,
  UnitOfWork,
  type UnitOfWorkShape,
  withUnitOfWork,
} from "./unit-of-work.js";
export { UnitOfWorkScope } from "./unit-of-work-scope.js";

// One bus; the *subscription* is the switch between consistency models, not the
// dispatch. `subscribe` runs in the publisher's fiber and can roll it back;
// `subscribeAfterCommit` runs once it has committed, in its own unit of work, and
// never can; `stream` feeds a saga and is never awaited. A producer says only that
// something happened, so one event can serve consumers that need different things.
export {
  EventBus,
  type EventBusShape,
  EventDispatchedOutsideUnitOfWork,
  type EventHandler,
  makeEventBus,
} from "./event-bus.js";
