// Declaring and handling messages: `Command.make`, `Command.group`, `Command.handlersOf`,
// and `Command.dispatcher` — a module's own dispatch surface, one method per tag it owns.
export * as Command from "./command.js";
export * as Query from "./query.js";

// The application-wide buses a caller dispatches through, plus the routing table that
// composes per-module dispatchers into one. The Tags and their shapes are what ordinary
// code depends on; `makeCommandBus` / `makeQueryBus` / `mergeDispatchTables` take the
// whole table and belong only where an application is composed.
export { CommandBus, type CommandBusShape, makeCommandBus } from "./command-bus.js";
export { type DispatchTable, mergeDispatchTables } from "./dispatch-table.js";
export { makeQueryBus, QueryBus, type QueryBusShape } from "./query-bus.js";
