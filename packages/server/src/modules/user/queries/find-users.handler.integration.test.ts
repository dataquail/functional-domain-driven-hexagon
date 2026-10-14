import { deepStrictEqual } from "node:assert";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { UserRepository } from "@/modules/user/domain/user/user.repository.ts";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.ts";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.ts";
import { UserRepositoryLive } from "@/modules/user/infrastructure/repositories/user.repository-live.ts";
import { findUsersHandler } from "@/modules/user/queries/find-users.handler.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const address = AddressValueObject.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const carolId = UserId.make("33333333-3333-3333-3333-333333333333");

const aliceTime = DateTime.makeUnsafe("2025-01-01T00:00:00Z");
const bobTime = DateTime.makeUnsafe("2025-02-01T00:00:00Z");
const carolTime = DateTime.makeUnsafe("2025-03-01T00:00:00Z");

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seed = (id: UserId, email: string, now: DateTime.Utc) =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const { user } = UserRootOps.create({ id, email, address: Option.some(address), now });
    yield* repo.insertOne(user);
  });

describeIntegration(
  "findUsersHandler (integration)",
  { layer: TestLayer, tables: ["user.users"] },
  (it) => {
    it.effect("returns rows ordered by created_at desc with paging metadata", () =>
      Effect.gen(function* () {
        yield* seed(aliceId, "alice@example.com", aliceTime);
        yield* seed(bobId, "bob@example.com", bobTime);
        yield* seed(carolId, "carol@example.com", carolTime);

        const result = yield* findUsersHandler({ page: 1, pageSize: 2 });
        deepStrictEqual(result.page, 1);
        deepStrictEqual(result.pageSize, 2);
        deepStrictEqual(result.total, 3);
        deepStrictEqual(result.users.length, 2);
        deepStrictEqual(
          result.users.map((u) => u.email),
          ["carol@example.com", "bob@example.com"],
        );
      }),
    );

    it.effect("returns the correct page when offset", () =>
      Effect.gen(function* () {
        yield* seed(aliceId, "alice@example.com", aliceTime);
        yield* seed(bobId, "bob@example.com", bobTime);
        yield* seed(carolId, "carol@example.com", carolTime);

        const result = yield* findUsersHandler({ page: 2, pageSize: 2 });
        deepStrictEqual(result.total, 3);
        deepStrictEqual(result.users.length, 1);
        deepStrictEqual(result.users[0]?.email, "alice@example.com");
      }),
    );

    it.effect("returns total 0 and empty users when the table is empty", () =>
      Effect.gen(function* () {
        const result = yield* findUsersHandler({ page: 1, pageSize: 10 });
        deepStrictEqual(result.total, 0);
        deepStrictEqual(result.users, []);
      }),
    );
  },
);
