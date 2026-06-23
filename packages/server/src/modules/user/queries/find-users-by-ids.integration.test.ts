import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { UserRepository } from "@/modules/user/domain/ports/repositories/user-repository.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/user-repository-live.js";
import { findUsersByIds } from "@/modules/user/queries/find-users-by-ids.js";
import { FindUsersByIdsQuery } from "@/modules/user/queries/find-users-by-ids-query.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const address = Address.make({ country: "USA", street: "123 Main St", postalCode: "12345" });
const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const carolId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("findUsersByIds (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("user.users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("returns only the users whose ids are in the list", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const alice = User.create({ id: aliceId, email: "alice@example.com", address, now }).user;
      const bob = User.create({ id: bobId, email: "bob@example.com", address, now }).user;
      const carol = User.create({ id: carolId, email: "carol@example.com", address, now }).user;
      yield* repo.insert(alice);
      yield* repo.insert(bob);
      yield* repo.insert(carol);

      const result = yield* findUsersByIds(FindUsersByIdsQuery.make({ ids: [aliceId, carolId] }));
      deepStrictEqual(result.length, 2);
      deepStrictEqual(
        new Set(result.map((u) => u.email)),
        new Set(["alice@example.com", "carol@example.com"]),
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns empty for an empty id list (no SQL dispatched)", () =>
    Effect.gen(function* () {
      const result = yield* findUsersByIds(FindUsersByIdsQuery.make({ ids: [] }));
      deepStrictEqual(result, []);
    }).pipe(Effect.provide(TestLayer)),
  );
});
