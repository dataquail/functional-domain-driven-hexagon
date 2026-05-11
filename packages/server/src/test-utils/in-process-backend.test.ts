// Smoke test for the in-process backend. Drives one round-trip per
// HTTP verb (GET / POST / PUT / DELETE) through the real backend
// handlers over the FakeDatabase. Sized to catch wiring regressions,
// not to be exhaustive — the per-handler contract is covered by the
// existing endpoint integration tests.

import { Api } from "@/api.js";
import { UserId } from "@/platform/ids/user-id.js";
import { startInProcessBackend } from "@/test-utils/in-process-backend.js";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { TodosContract, UserContract } from "@org/contracts/api/Contracts";
import { TodoId } from "@org/contracts/EntityIds";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { afterEach, beforeEach } from "vitest";

const adminUserId = UserId.make("00000000-0000-0000-0000-000000000001");

let backend: Awaited<ReturnType<typeof startInProcessBackend>>;

beforeEach(async () => {
  backend = await startInProcessBackend({
    signedInAs: { userId: adminUserId },
  });
});

afterEach(async () => {
  await backend.dispose();
});

// Build the HttpApiClient wired to the in-process backend's fetch.
const makeClient = () => {
  const HttpClientLive = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, backend.fetch)),
  );
  return HttpApiClient.make(Api, { baseUrl: "http://in-process.test" }).pipe(
    Effect.provide(HttpClientLive),
  );
};

describe("startInProcessBackend — smoke", () => {
  it.effect("POST /users creates a user the FakeDatabase can see", () =>
    Effect.gen(function* () {
      const client = yield* makeClient();

      const result = yield* client.user.create({
        payload: UserContract.CreateUserPayload.make({
          email: "alice@example.com",
          country: "USA",
          street: "Main",
          postalCode: "12345",
        }),
      });

      // The response includes the new userId; the FakeDatabase has it.
      const userId = UserId.make(result.id);
      ok(backend.db.users.has(userId));
    }),
  );

  it.effect("POST /todos then GET /todos round-trip returns the created todo", () =>
    Effect.gen(function* () {
      const client = yield* makeClient();

      const created = yield* client.todos.create({
        payload: TodosContract.CreateTodoPayload.make({ title: "Buy milk" }),
      });
      ok(created.title === "Buy milk");

      const list = yield* client.todos.get();
      const titles = list.map((t) => t.title);
      ok(titles.includes("Buy milk"));
    }),
  );

  it.effect("PUT /todos/:id updates the todo via the real handler", () =>
    Effect.gen(function* () {
      const client = yield* makeClient();

      const created = yield* client.todos.create({
        payload: TodosContract.CreateTodoPayload.make({ title: "Old title" }),
      });

      const updated = yield* client.todos.update({
        payload: TodosContract.UpdateTodoPayload.make({
          id: TodoId.make(created.id),
          title: "New title",
          completed: true,
        }),
      });
      deepStrictEqual(updated.title, "New title");
      deepStrictEqual(updated.completed, true);
    }),
  );

  it.effect("DELETE /todos/:id removes the todo from the FakeDatabase", () =>
    Effect.gen(function* () {
      const client = yield* makeClient();

      const created = yield* client.todos.create({
        payload: TodosContract.CreateTodoPayload.make({ title: "To be deleted" }),
      });
      const id = TodoId.make(created.id);
      ok(backend.db.todos.has(id));

      yield* client.todos.delete({ payload: id });
      ok(!backend.db.todos.has(id));
    }),
  );
});
