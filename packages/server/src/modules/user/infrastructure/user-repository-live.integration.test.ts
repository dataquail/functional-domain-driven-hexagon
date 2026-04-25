import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user-errors.js";
import { UserId } from "@/modules/user/domain/user-id.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/user-repository-live.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));

const address = Address.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const alice = User.create({ id: aliceId, email: "alice@example.com", address, now }).user;

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

// Integration tests share one DB and truncate between cases, so they must run
// sequentially — vitest.shared.ts sets sequence.concurrent: true globally.
const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("UserRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("users").pipe(Effect.provide(TestDatabaseLive)));
  });

  describe("insert", () => {
    it.effect("persists the user and decodes it back via findById", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insert(alice);
        const found = yield* repo.findById(alice.id);
        deepStrictEqual(found.id, alice.id);
        deepStrictEqual(found.email, alice.email);
        deepStrictEqual(found.role, "guest");
        deepStrictEqual(found.address.country, "USA");
        deepStrictEqual(found.address.street, "123 Main St");
        deepStrictEqual(found.address.postalCode, "12345");
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails UserAlreadyExists on duplicate email (unique violation → domain error)", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insert(alice);
        const clashing = User.create({
          id: bobId,
          email: alice.email,
          address,
          now,
        }).user;
        const exit = yield* Effect.exit(repo.insert(clashing));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof UserAlreadyExists, true);
          deepStrictEqual((error as UserAlreadyExists).email, alice.email);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("findById", () => {
    it.effect("fails UserNotFound for an unknown id", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const exit = yield* Effect.exit(repo.findById(aliceId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("findByEmail", () => {
    it.effect("returns Some(user) when the email matches", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insert(alice);
        const result = yield* repo.findByEmail("alice@example.com");
        deepStrictEqual(Option.isSome(result), true);
        if (Option.isSome(result)) {
          deepStrictEqual(result.value.id, alice.id);
        }
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("returns None when no user has the email", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const result = yield* repo.findByEmail("nobody@example.com");
        deepStrictEqual(Option.isNone(result), true);
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("update", () => {
    it.effect("overwrites role and updatedAt", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insert(alice);
        const { user: admin } = User.makeAdmin(alice, { now: later });
        yield* repo.update(admin);
        const found = yield* repo.findById(alice.id);
        deepStrictEqual(found.role, "admin");
        deepStrictEqual(
          DateTime.toDate(found.updatedAt).toISOString(),
          DateTime.toDate(later).toISOString(),
        );
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails UserNotFound when the user isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const exit = yield* Effect.exit(repo.update(alice));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("remove", () => {
    it.effect("deletes the row", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insert(alice);
        yield* repo.remove(alice.id);
        const exit = yield* Effect.exit(repo.findById(alice.id));
        deepStrictEqual(Exit.isFailure(exit), true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails UserNotFound when the user isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const exit = yield* Effect.exit(repo.remove(aliceId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("transaction", () => {
    it.effect("commits inserts when the body succeeds", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const db = yield* Database.Database;
        yield* db.transaction((tx) =>
          repo.insert(alice).pipe(Database.TransactionContext.provide(tx)),
        );
        const found = yield* repo.findByEmail(alice.email);
        deepStrictEqual(Option.isSome(found), true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("rolls back inserts when the body fails (surfaces typed error)", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const db = yield* Database.Database;
        const exit = yield* Effect.exit(
          db.transaction((tx) =>
            Effect.gen(function* () {
              yield* repo.insert(alice).pipe(Database.TransactionContext.provide(tx));
              return yield* Effect.fail(new UserNotFound({ userId: bobId }));
            }),
          ),
        );
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
        const after = yield* repo.findByEmail(alice.email);
        deepStrictEqual(Option.isNone(after), true);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
