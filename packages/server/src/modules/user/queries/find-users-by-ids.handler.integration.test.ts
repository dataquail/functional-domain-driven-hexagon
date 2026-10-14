import { deepStrictEqual } from "node:assert";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { UserRepository } from "@/modules/user/domain/user/user.repository";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object";
import { UserRepositoryLive } from "@/modules/user/infrastructure/repositories/user.repository-live";
import { findUsersByIdsHandler } from "@/modules/user/queries/find-users-by-ids.handler";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const address = AddressValueObject.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const carolId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "findUsersByIdsHandler (integration)",
  { layer: TestLayer, tables: ["user.users"] },
  (it) => {
    it.effect("returns only the users whose ids are in the list", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;

        const alice = UserRootOps.create({
          id: aliceId,
          email: "alice@example.com",
          address: Option.some(address),
          now,
        }).user;

        const bob = UserRootOps.create({
          id: bobId,
          email: "bob@example.com",
          address: Option.some(address),
          now,
        }).user;

        const carol = UserRootOps.create({
          id: carolId,
          email: "carol@example.com",
          address: Option.some(address),
          now,
        }).user;

        yield* repo.insertOne(alice);
        yield* repo.insertOne(bob);
        yield* repo.insertOne(carol);

        const result = yield* findUsersByIdsHandler({ ids: [aliceId, carolId] });
        deepStrictEqual(result.length, 2);
        deepStrictEqual(
          new Set(result.map((u) => u.email)),
          new Set(["alice@example.com", "carol@example.com"]),
        );
      }),
    );

    it.effect("returns empty for an empty id list (no SQL dispatched)", () =>
      Effect.gen(function* () {
        const result = yield* findUsersByIdsHandler({ ids: [] });
        deepStrictEqual(result, []);
      }),
    );
  },
);
