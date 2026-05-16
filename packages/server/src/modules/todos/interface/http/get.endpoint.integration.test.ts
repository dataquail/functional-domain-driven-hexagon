import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("GET /todos (integration)", () => {
  const { run } = useServerTestRuntime(["todos"]);

  it("returns an empty list initially", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const todos = yield* client.todos.get();
        deepStrictEqual(todos.length, 0);
      }),
    );
  });

  it("returns todos in created_at desc order", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.todos.create({ payload: { title: "first" } });
        yield* client.todos.create({ payload: { title: "second" } });
        yield* client.todos.create({ payload: { title: "third" } });
        const todos = yield* client.todos.get();
        deepStrictEqual(
          todos.map((t) => t.title),
          ["third", "second", "first"],
        );
      }),
    );
  });
});
