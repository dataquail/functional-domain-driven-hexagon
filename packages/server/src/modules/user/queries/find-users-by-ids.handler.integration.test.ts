import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.js";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/repositories/user.repository-live.js";
import { findUsersByIds } from "@/modules/user/queries/find-users-by-ids.handler.js";
import { FindUsersByIdsQuery } from "@/modules/user/queries/find-users-by-ids.query.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const address = AddressValueObject.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});
const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const carolId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = describe.sequential;

suite("findUsersByIds (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("user.users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("returns only the users whose ids are in the list", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const alice = UserRootOps.create({
        id: aliceId,
        email: "alice@example.com",
        address,
        now,
      }).user;
      const bob = UserRootOps.create({ id: bobId, email: "bob@example.com", address, now }).user;
      const carol = UserRootOps.create({
        id: carolId,
        email: "carol@example.com",
        address,
        now,
      }).user;
      yield* repo.insertOne(alice);
      yield* repo.insertOne(bob);
      yield* repo.insertOne(carol);

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
