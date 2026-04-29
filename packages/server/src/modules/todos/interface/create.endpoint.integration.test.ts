import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, RowSchemas, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("POST /todos (integration)", () => {
  const { run } = useServerTestRuntime(["todos"]);

  it("creates a todo and persists it", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.todos.create({ payload: { title: "Buy milk" } });
        ok(typeof res.id === "string" && res.id.length > 0);
        deepStrictEqual(res.title, "Buy milk");
        deepStrictEqual(res.completed, false);

        const db = yield* Database.Database;
        const rows = yield* db.execute((c) =>
          c.any(sql.type(RowSchemas.TodoRowStd)`
            SELECT * FROM todos WHERE id = ${res.id}
          `),
        );
        deepStrictEqual(rows.length, 1);
        deepStrictEqual(rows[0]?.title, "Buy milk");
      }),
    );
  });
});
