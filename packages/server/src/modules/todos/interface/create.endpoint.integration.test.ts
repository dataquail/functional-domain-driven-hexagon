import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("POST /todos (integration)", () => {
  const { run } = useServerTestRuntime(["todos"]);

  it("creates a todo and returns the persisted shape", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.todos.create({ payload: { title: "Buy milk" } });
        // The HTTP response is the persisted Todo per the contract. The repo
        // integration test (`todos-repository-live.integration.test.ts`)
        // covers actual persistence; asserting it again here would be
        // redundant. The GET endpoint integration test covers read-side
        // visibility.
        ok(typeof res.id === "string" && res.id.length > 0);
        deepStrictEqual(res.title, "Buy milk");
        deepStrictEqual(res.completed, false);
      }),
    );
  });
});
