import { Api } from "@/api.js";
import { TodoId } from "@/modules/todos/domain/todo-id.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { TodosContract } from "@org/contracts/api/Contracts";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("DELETE /todos/:id (integration)", () => {
  const { run } = useServerTestRuntime(["todos"]);

  it("removes the todo", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const created = yield* client.todos.create({ payload: { title: "Buy milk" } });
        yield* client.todos.delete({ payload: created.id });
        const todos = yield* client.todos.get();
        deepStrictEqual(todos.length, 0);
      }),
    );
  });

  it("returns 404 TodoNotFoundError for an unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const ghostId = TodoId.make("00000000-0000-0000-0000-000000000000");
        const exit = yield* Effect.exit(client.todos.delete({ payload: ghostId }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof TodosContract.TodoNotFoundError);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});
