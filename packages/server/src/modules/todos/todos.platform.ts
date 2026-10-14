// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is todos.exports.ts, and it is empty — todos is
// a leaf.
export {
  TodoCollectionResolverEntry,
  TodoCollectionResolverEntryLive,
  TodoResolverEntry,
  TodoResolverEntryLive,
} from "./policies/todo.resource-resolvers";
export { TodoPoliciesLive, TodoPolicyContribution } from "./policies/todos.policies";
export { todoCommandGroup, TodoCommands } from "./todo.command-handlers";
export { TodoQueries, todoQueryGroup } from "./todo.query-handlers";
export { TodosModule } from "./todos.module";
