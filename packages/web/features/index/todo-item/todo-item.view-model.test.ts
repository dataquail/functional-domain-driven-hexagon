import { describe, expect, it } from "@effect/vitest";
import * as TodosContract from "@org/contracts/api/TodosContract";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";
import { todosHandlers } from "@/test/handlers/todos";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import { deleteTodoActionAtom, toggleTodoAtom } from "./todo-item.view-model";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const run = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });

describe("todo item ViewModel", () => {
  it.effect("sends the todo back with completion inverted, keeping its title", () =>
    Effect.gen(function* () {
      const sent: Array<TodosContract.UpdateTodoPayload> = [];
      server.use(
        typedHandler(getEndpoint(TodosContract.Group, "update"), ({ path, payload }) => {
          sent.push(payload);

          return Effect.succeed(
            makeTodo({ id: path.id, title: payload.title, completed: payload.completed }),
          );
        }),
      );

      const registry = makeRegistry();
      registry.set(toggleTodoAtom, {
        orgId: TEST_ORG_ID,
        todo: makeTodo({ title: "Buy milk", completed: false }),
      });
      yield* run(registry, toggleTodoAtom);

      expect(sent).toEqual([{ title: "Buy milk", completed: true }]);
    }),
  );

  it.effect("inverts back the other way, so a completed todo can be reopened", () =>
    Effect.gen(function* () {
      const sent: Array<boolean> = [];
      server.use(
        typedHandler(getEndpoint(TodosContract.Group, "update"), ({ path, payload }) => {
          sent.push(payload.completed);

          return Effect.succeed(makeTodo({ id: path.id, completed: payload.completed }));
        }),
      );

      const registry = makeRegistry();
      registry.set(toggleTodoAtom, { orgId: TEST_ORG_ID, todo: makeTodo({ completed: true }) });
      yield* run(registry, toggleTodoAtom);

      expect(sent).toEqual([false]);
    }),
  );

  it.effect("announces a successful toggle", () =>
    Effect.gen(function* () {
      server.use(todosHandlers.update());

      const registry = makeRegistry();
      registry.set(toggleTodoAtom, { orgId: TEST_ORG_ID, todo: makeTodo() });
      yield* run(registry, toggleTodoAtom);

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Todo updated!",
      });
    }),
  );

  it.effect("surfaces the server's message when the todo is already gone", () =>
    Effect.gen(function* () {
      server.use(todosHandlers.update({ result: "TodoNotFoundError" }));

      const registry = makeRegistry();
      registry.set(toggleTodoAtom, { orgId: TEST_ORG_ID, todo: makeTodo() });
      yield* Effect.exit(run(registry, toggleTodoAtom));

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "error",
        message: "Todo not found.",
      });
    }),
  );

  it.effect("deletes by id and announces it", () =>
    Effect.gen(function* () {
      const deleted: Array<string> = [];
      server.use(
        typedHandler(getEndpoint(TodosContract.Group, "delete"), ({ path }) => {
          deleted.push(path.id);

          return Effect.void;
        }),
      );

      const todo = makeTodo();
      const registry = makeRegistry();
      registry.set(deleteTodoActionAtom, { orgId: TEST_ORG_ID, id: todo.id });
      yield* run(registry, deleteTodoActionAtom);

      expect(deleted).toEqual([todo.id]);
      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Todo deleted!",
      });
    }),
  );

  it.effect("surfaces a failed delete rather than claiming success", () =>
    Effect.gen(function* () {
      server.use(todosHandlers.delete({ result: "TodoNotFoundError" }));

      const registry = makeRegistry();
      registry.set(deleteTodoActionAtom, { orgId: TEST_ORG_ID, id: makeTodo().id });
      yield* Effect.exit(run(registry, deleteTodoActionAtom));

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "error",
        message: "Todo not found.",
      });
    }),
  );
});
