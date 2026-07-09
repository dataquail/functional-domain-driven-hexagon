import { OrganizationId, TodoId } from "@org/contracts/EntityIds";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";

import { authedClient, resolveOrg, toCliError } from "../internal.js";

const orgOption = Flag.string("org").pipe(
  Flag.optional,
  Flag.withAlias("o"),
  Flag.withDescription("Organization id (defaults to the configured org)"),
);

const titleArg = Argument.string("title");
const todoIdArg = Argument.string("todoId");

const list = Command.make("list", { org: orgOption }, ({ org }) =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgId = OrganizationId.make(yield* resolveOrg(org));
    const todos = yield* client.cliTodos.list({ params: { orgId } });
    if (todos.length === 0) {
      yield* Console.log("(no todos)");
      return;
    }
    for (const todo of todos) {
      yield* Console.log(`${todo.completed ? "[x]" : "[ ]"} ${todo.id}  ${todo.title}`);
    }
  }).pipe(Effect.mapError(toCliError)),
);

const create = Command.make("create", { org: orgOption, title: titleArg }, ({ org, title }) =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgId = OrganizationId.make(yield* resolveOrg(org));
    const todo = yield* client.cliTodos.create({ params: { orgId }, payload: { title } });
    yield* Console.log(`Created ${todo.id}: ${todo.title}`);
  }).pipe(Effect.mapError(toCliError)),
);

const complete = Command.make("complete", { org: orgOption, id: todoIdArg }, ({ id, org }) =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgId = OrganizationId.make(yield* resolveOrg(org));
    const todo = yield* client.cliTodos.complete({ params: { orgId, id: TodoId.make(id) } });
    yield* Console.log(`Completed ${todo.id}: ${todo.title}`);
  }).pipe(Effect.mapError(toCliError)),
);

const remove = Command.make("remove", { org: orgOption, id: todoIdArg }, ({ id, org }) =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgId = OrganizationId.make(yield* resolveOrg(org));
    yield* client.cliTodos.remove({ params: { orgId, id: TodoId.make(id) } });
    yield* Console.log(`Removed ${id}.`);
  }).pipe(Effect.mapError(toCliError)),
);

export const todosCommand = Command.make("todos", {}, () =>
  Console.log("Usage: org todos <list|create|complete|remove>"),
).pipe(Command.withSubcommands([list, create, complete, remove]));
