import * as TodosContract from "@org/contracts/api/TodosContract";
import * as Effect from "effect/Effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

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
) => Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }));

describe("todo item ViewModel", () => {
  it("sends the todo back with completion inverted, keeping its title", async () => {
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
    await run(registry, toggleTodoAtom);

    expect(sent).toEqual([{ title: "Buy milk", completed: true }]);
  });

  it("inverts back the other way, so a completed todo can be reopened", async () => {
    const sent: Array<boolean> = [];
    server.use(
      typedHandler(getEndpoint(TodosContract.Group, "update"), ({ path, payload }) => {
        sent.push(payload.completed);
        return Effect.succeed(makeTodo({ id: path.id, completed: payload.completed }));
      }),
    );

    const registry = makeRegistry();
    registry.set(toggleTodoAtom, { orgId: TEST_ORG_ID, todo: makeTodo({ completed: true }) });
    await run(registry, toggleTodoAtom);

    expect(sent).toEqual([false]);
  });

  it("announces a successful toggle", async () => {
    server.use(todosHandlers.update());

    const registry = makeRegistry();
    registry.set(toggleTodoAtom, { orgId: TEST_ORG_ID, todo: makeTodo() });
    await run(registry, toggleTodoAtom);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Todo updated!",
    });
  });

  it("surfaces the server's message when the todo is already gone", async () => {
    server.use(todosHandlers.update({ result: "TodoNotFoundError" }));

    const registry = makeRegistry();
    registry.set(toggleTodoAtom, { orgId: TEST_ORG_ID, todo: makeTodo() });
    await run(registry, toggleTodoAtom).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "error",
      message: "Todo not found.",
    });
  });

  it("deletes by id and announces it", async () => {
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
    await run(registry, deleteTodoActionAtom);

    expect(deleted).toEqual([todo.id]);
    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Todo deleted!",
    });
  });

  it("surfaces a failed delete rather than claiming success", async () => {
    server.use(todosHandlers.delete({ result: "TodoNotFoundError" }));

    const registry = makeRegistry();
    registry.set(deleteTodoActionAtom, { orgId: TEST_ORG_ID, id: makeTodo().id });
    await run(registry, deleteTodoActionAtom).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "error",
      message: "Todo not found.",
    });
  });
});
