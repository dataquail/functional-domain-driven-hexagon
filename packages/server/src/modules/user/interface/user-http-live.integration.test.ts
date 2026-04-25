import { Api } from "@/api.js";
import { hasTestDatabase, runMigrations, truncate } from "@/test-utils/test-database.js";
import { TestServerLive } from "@/test-utils/test-server.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { UserContract } from "@org/contracts/api/Contracts";
import { Database } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { afterAll, beforeAll, beforeEach } from "vitest";

type ServerContext = Layer.Layer.Success<typeof TestServerLive>;
type ServerError = Layer.Layer.Error<typeof TestServerLive>;

const basePayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("UserHttpLive (integration)", () => {
  let runtime: ManagedRuntime.ManagedRuntime<ServerContext, ServerError>;

  beforeAll(async () => {
    await runMigrations();
    runtime = ManagedRuntime.make(TestServerLive);
    // Force the runtime to finish building so the server is listening before
    // the first test runs.
    await runtime.runPromise(Effect.void);
  });

  afterAll(async () => {
    await runtime.dispose();
  });

  beforeEach(async () => {
    await runtime.runPromise(
      Effect.gen(function* () {
        yield* truncate("users");
      }),
    );
  });

  const run = <A, E>(effect: Effect.Effect<A, E, ServerContext>) => runtime.runPromise(effect);

  it("POST /users creates a user and persists it", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.user.create({ payload: basePayload });
        ok(typeof res.id === "string" && res.id.length > 0);

        // DB side-effect check via the shared Database service.
        const db = yield* Database.Database;
        const rows = yield* db.execute((c) =>
          c.query.usersTable.findMany({
            where: (u, { eq }) => eq(u.email, basePayload.email),
          }),
        );
        deepStrictEqual(rows.length, 1);
        deepStrictEqual(rows[0]?.role, "guest");
      }),
    );
  });

  it("POST /users returns 409 UserAlreadyExistsError on duplicate email", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.user.create({ payload: basePayload });
        const exit = yield* Effect.exit(client.user.create({ payload: basePayload }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          const err = exit.cause.error;
          ok(err instanceof UserContract.UserAlreadyExistsError);
          deepStrictEqual(err.email, basePayload.email);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });

  it("GET /users returns a paginated list after creates", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.user.create({ payload: basePayload });
        yield* client.user.create({ payload: { ...basePayload, email: "bob@example.com" } });
        const res = yield* client.user.find({ urlParams: { page: 1, pageSize: 10 } });
        deepStrictEqual(res.page, 1);
        deepStrictEqual(res.pageSize, 10);
        deepStrictEqual(res.total, 2);
        deepStrictEqual(res.users.length, 2);
        const emails = res.users.map((u) => u.email).sort();
        deepStrictEqual(emails, ["alice@example.com", "bob@example.com"]);
      }),
    );
  });

  it("DELETE /users/:id removes the user", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        yield* client.user.delete({ path: { id } });
        const after = yield* client.user.find({ urlParams: { page: 1, pageSize: 10 } });
        deepStrictEqual(after.total, 0);
      }),
    );
  });

  it("DELETE /users/:id returns 404 UserNotFoundError for unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.user.delete({
            path: { id: "00000000-0000-0000-0000-000000000000" as never },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof UserContract.UserNotFoundError);
        } else {
          throw new Error("expected a typed Fail");
        }
      }),
    );
  });

  it("PUT /users/:id/role promotes the user to admin", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        yield* client.user.changeRole({ path: { id }, payload: { role: "admin" } });
        const res = yield* client.user.find({ urlParams: { page: 1, pageSize: 10 } });
        deepStrictEqual(res.users[0]?.role, "admin");
      }),
    );
  });

  it("PUT /users/:id/role returns 404 UserNotFoundError for unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.user.changeRole({
            path: { id: "00000000-0000-0000-0000-000000000000" as never },
            payload: { role: "admin" },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof UserContract.UserNotFoundError);
        }
      }),
    );
  });
});
