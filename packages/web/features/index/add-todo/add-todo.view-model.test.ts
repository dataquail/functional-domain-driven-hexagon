import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as TodosContract from "@org/contracts/api/TodosContract";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

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

  return AtomRegistry.getResult(registry, submitAtom, { suspendOnWaiting: true });
};

describe("add todo ViewModel", () => {
  it("rejects a blank title and accepts a filled one", () => {
    const registry = makeRegistry();
    expect(registry.get(errorsAtom).title).toBeTypeOf("string");

    registry.set(setTitleAtom, "Buy milk");
    expect(registry.get(errorsAtom)).toEqual({});
  });

  it.effect("keeps the error hidden until the first submit attempt", () =>
    Effect.gen(function* () {
      const registry = makeRegistry();
      expect(registry.get(visibleErrorsAtom)).toEqual({});

      yield* submit(registry);

      expect(registry.get(submitAttemptedAtom)).toBe(true);
      expect(registry.get(visibleErrorsAtom).title).toBeTypeOf("string");
    }),
  );

  it.effect("does not call the API, or claim success, when the title is blank", () =>
    Effect.gen(function* () {
      // No handler registered: MSW errors on any unhandled request, so a call
      // here would fail the test rather than pass silently.
      const registry = makeRegistry();

      yield* submit(registry);

      assertNone(registry.get(notificationAtom));
    }),
  );

  it.effect("posts the title to the org, announces it, and clears the field", () =>
    Effect.gen(function* () {
      const posted: Array<{ orgId: string; title: string }> = [];
      server.use(
        typedHandler(getEndpoint(TodosContract.Group, "create"), ({ path, payload }) => {
          posted.push({ orgId: path.orgId, title: payload.title });

          return Effect.succeed(makeTodo({ title: payload.title }));
        }),
      );

      const registry = makeRegistry();
      registry.set(setTitleAtom, "Buy milk");
      yield* submit(registry);

      expect(posted).toEqual([{ orgId: TEST_ORG_ID, title: "Buy milk" }]);
      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Todo created!",
      });
      expect(registry.get(fieldsAtom)).toEqual({ title: "" });
      expect(registry.get(submitAttemptedAtom)).toBe(false);
    }),
  );

  it.effect("keeps what the user typed when the server refuses", () =>
    Effect.gen(function* () {
      server.use(todosHandlers.create({ result: "Forbidden" }));

      const registry = makeRegistry();
      registry.set(setTitleAtom, "Buy milk");
      yield* Effect.exit(submit(registry));

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({ kind: "error" });
      expect(registry.get(fieldsAtom)).toEqual({ title: "Buy milk" });
    }),
  );
});
