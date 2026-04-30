import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/user-repository-live.js";
import { FindUsersQuery } from "@/modules/user/queries/find-users-query.js";
import { findUsers } from "@/modules/user/queries/find-users.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

const address = Address.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const carolId = UserId.make("33333333-3333-3333-3333-333333333333");

const aliceTime = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const bobTime = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));
const carolTime = DateTime.unsafeMake(new Date("2025-03-01T00:00:00Z"));

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seed = (id: UserId, email: string, now: DateTime.Utc) =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const { user } = User.create({ id, email, address, now });
    yield* repo.insert(user);
  });

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("findUsers (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("returns rows ordered by created_at desc with paging metadata", () =>
    Effect.gen(function* () {
      yield* seed(aliceId, "alice@example.com", aliceTime);
      yield* seed(bobId, "bob@example.com", bobTime);
      yield* seed(carolId, "carol@example.com", carolTime);

      const result = yield* findUsers(FindUsersQuery.make({ page: 1, pageSize: 2 }));
      deepStrictEqual(result.page, 1);
      deepStrictEqual(result.pageSize, 2);
      deepStrictEqual(result.total, 3);
      deepStrictEqual(result.users.length, 2);
      deepStrictEqual(
        result.users.map((u) => u.email),
        ["carol@example.com", "bob@example.com"],
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns the correct page when offset", () =>
    Effect.gen(function* () {
      yield* seed(aliceId, "alice@example.com", aliceTime);
      yield* seed(bobId, "bob@example.com", bobTime);
      yield* seed(carolId, "carol@example.com", carolTime);

      const result = yield* findUsers(FindUsersQuery.make({ page: 2, pageSize: 2 }));
      deepStrictEqual(result.total, 3);
      deepStrictEqual(result.users.length, 1);
      deepStrictEqual(result.users[0]?.email, "alice@example.com");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns total 0 and empty users when the table is empty", () =>
    Effect.gen(function* () {
      const result = yield* findUsers(FindUsersQuery.make({ page: 1, pageSize: 10 }));
      deepStrictEqual(result.total, 0);
      deepStrictEqual(result.users, []);
    }).pipe(Effect.provide(TestLayer)),
  );
});
