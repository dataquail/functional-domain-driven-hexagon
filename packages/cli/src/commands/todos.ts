import * as Args from "@effect/cli/Args";
import * as Command from "@effect/cli/Command";
import * as Options from "@effect/cli/Options";
import { OrganizationId, TodoId } from "@org/contracts/EntityIds";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

import { authedClient, resolveOrg, toCliError } from "../internal.js";

const orgOption = Options.text("org").pipe(
  Options.optional,
  Options.withAlias("o"),
  Options.withDescription("Organization id (defaults to the configured org)"),
);

const titleArg = Args.text({ name: "title" });
const todoIdArg = Args.text({ name: "todoId" });

const list = Command.make("list", { org: orgOption }, ({ org }) =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgId = OrganizationId.make(yield* resolveOrg(org));
    const todos = yield* client.cliTodos.list({ path: { orgId } });
    if (todos.length === 0) {
      yield* Console.log("(no todos)");
      return;
    }
    for (const todo of todos) {
      yield* Console.log(`${todo.completed ? "[x]" : "[ ]"} ${todo.id}  ${todo.title}`);
    }
  }).pipe(Effect.catchAll((error) => Effect.fail(toCliError(error)))),
);

const create = Command.make("create", { org: orgOption, title: titleArg }, ({ org, title }) =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgId = OrganizationId.make(yield* resolveOrg(org));
    const todo = yield* client.cliTodos.create({ path: { orgId }, payload: { title } });
    yield* Console.log(`Created ${todo.id}: ${todo.title}`);
  }).pipe(Effect.catchAll((error) => Effect.fail(toCliError(error)))),
);

const complete = Command.make("complete", { org: orgOption, id: todoIdArg }, ({ id, org }) =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgId = OrganizationId.make(yield* resolveOrg(org));
    const todo = yield* client.cliTodos.complete({ path: { orgId, id: TodoId.make(id) } });
    yield* Console.log(`Completed ${todo.id}: ${todo.title}`);
  }).pipe(Effect.catchAll((error) => Effect.fail(toCliError(error)))),
);

const remove = Command.make("remove", { org: orgOption, id: todoIdArg }, ({ id, org }) =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgId = OrganizationId.make(yield* resolveOrg(org));
    yield* client.cliTodos.remove({ path: { orgId, id: TodoId.make(id) } });
    yield* Console.log(`Removed ${id}.`);
  }).pipe(Effect.catchAll((error) => Effect.fail(toCliError(error)))),
);

export const todosCommand = Command.make("todos", {}, () =>
  Console.log("Usage: org todos <list|create|complete|remove>"),
).pipe(Command.withSubcommands([list, create, complete, remove]));
