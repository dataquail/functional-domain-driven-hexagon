import * as TodosContract from "@org/contracts/api/TodosContract";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";
import { todosHandlers } from "@/test/handlers/todos";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import {
  errorsAtom,
  fieldsAtom,
  setTitleAtom,
  submitAtom,
  submitAttemptedAtom,
  visibleErrorsAtom,
} from "./add-todo.view-model";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const submit = (registry: AtomRegistry.AtomRegistry) => {
  registry.set(submitAtom, TEST_ORG_ID);
  return Effect.runPromise(
    AtomRegistry.getResult(registry, submitAtom, { suspendOnWaiting: true }),
  );
};

describe("add todo ViewModel", () => {
  it("rejects a blank title and accepts a filled one", () => {
    const registry = makeRegistry();
    expect(registry.get(errorsAtom)?.title).toBeTypeOf("string");

    registry.set(setTitleAtom, "Buy milk");
    expect(registry.get(errorsAtom)).toBeNull();
  });

  it("keeps the error hidden until the first submit attempt", async () => {
    const registry = makeRegistry();
    expect(registry.get(visibleErrorsAtom)).toBeNull();

    await submit(registry);

    expect(registry.get(submitAttemptedAtom)).toBe(true);
    expect(registry.get(visibleErrorsAtom)?.title).toBeTypeOf("string");
  });

  it("does not call the API, or claim success, when the title is blank", async () => {
    // No handler registered: MSW errors on any unhandled request, so a call
    // here would fail the test rather than pass silently.
    const registry = makeRegistry();

    await submit(registry);

    expect(registry.get(notificationAtom)).toBeNull();
  });

  it("posts the title to the org, announces it, and clears the field", async () => {
    const posted: Array<{ orgId: string; title: string }> = [];
    server.use(
      typedHandler(getEndpoint(TodosContract.Group, "create"), ({ path, payload }) => {
        posted.push({ orgId: path.orgId, title: payload.title });
        return Effect.succeed(makeTodo({ title: payload.title }));
      }),
    );

    const registry = makeRegistry();
    registry.set(setTitleAtom, "Buy milk");
    await submit(registry);

    expect(posted).toEqual([{ orgId: TEST_ORG_ID, title: "Buy milk" }]);
    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Todo created!",
    });
    expect(registry.get(fieldsAtom)).toEqual({ title: "" });
    expect(registry.get(submitAttemptedAtom)).toBe(false);
  });

  it("keeps what the user typed when the server refuses", async () => {
    server.use(todosHandlers.create({ result: "Forbidden" }));

    const registry = makeRegistry();
    registry.set(setTitleAtom, "Buy milk");
    await submit(registry).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({ kind: "error" });
    expect(registry.get(fieldsAtom)).toEqual({ title: "Buy milk" });
  });
});
