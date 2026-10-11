import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/repositories/user.repository-live.js";
import { findUserIdByEmailHandler } from "@/modules/user/queries/find-user-id-by-email.handler.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const adaId = UserId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describe("findUserIdByEmailHandler (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("user.users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("answers with the id of the user registered under that email", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      yield* repo.insertOne(
        UserRootOps.create({ id: adaId, email: "ada@example.com", address: null, now }).user,
      );

      deepStrictEqual(yield* findUserIdByEmailHandler({ email: "ada@example.com" }), adaId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("answers null when no user has that email", () =>
    Effect.gen(function* () {
      deepStrictEqual(yield* findUserIdByEmailHandler({ email: "nobody@example.com" }), null);
    }).pipe(Effect.provide(TestLayer)),
  );
});
