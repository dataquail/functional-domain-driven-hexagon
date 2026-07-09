import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

import { UserRepository } from "@/modules/user/domain/ports/repositories/user.repository.js";
import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user.errors.js";
import { UserRootOps } from "@/modules/user/domain/user.root.js";
import { AddressValueObject } from "@/modules/user/domain/value-objects/address.value-object.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/repositories/user.repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.makeUnsafe(new Date("2025-02-01T00:00:00Z"));

const address = AddressValueObject.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const alice = UserRootOps.create({ id: aliceId, email: "alice@example.com", address, now }).user;

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

// Integration tests share one DB and truncate between cases, so they must run
// sequentially — vitest.shared.ts sets sequence.concurrent: true globally.
const suite = describe.sequential;

suite("UserRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("user.users").pipe(Effect.provide(TestDatabaseLive)));
  });

  describe("insert", () => {
    it.effect("persists the user and decodes it back via findOneById", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        const found = yield* repo.findOneById(alice.id);
        deepStrictEqual(found.id, alice.id);
        deepStrictEqual(found.email, alice.email);
        if (found.address === null) throw new Error("expected a stored address");
        deepStrictEqual(found.address.country, "USA");
        deepStrictEqual(found.address.street, "123 Main St");
        deepStrictEqual(found.address.postalCode, "12345");
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails UserAlreadyExists on duplicate email (unique violation → domain error)", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        const clashing = UserRootOps.create({
          id: bobId,
          email: alice.email,
          address,
          now,
        }).user;
        const exit = yield* Effect.exit(repo.insertOne(clashing));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
          deepStrictEqual(error instanceof UserAlreadyExists, true);
          deepStrictEqual((error as UserAlreadyExists).email, alice.email);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("findOneById", () => {
    it.effect("fails UserNotFound for an unknown id", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const exit = yield* Effect.exit(repo.findOneById(aliceId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("findOneByEmail", () => {
    it.effect("returns Some(user) when the email matches", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        const result = yield* repo.findOneByEmail("alice@example.com");
        deepStrictEqual(Option.isSome(result), true);
        if (Option.isSome(result)) {
          deepStrictEqual(result.value.id, alice.id);
        }
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("returns None when no user has the email", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const result = yield* repo.findOneByEmail("nobody@example.com");
        deepStrictEqual(Option.isNone(result), true);
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("update", () => {
    it.effect("overwrites address and updatedAt", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        const { user: updated } = UserRootOps.updateAddress(alice, {
          country: "Canada",
          now: later,
        });
        yield* repo.updateOne(updated);
        const found = yield* repo.findOneById(alice.id);
        deepStrictEqual(found.address?.country, "Canada");
        deepStrictEqual(
          DateTime.toDate(found.updatedAt).toISOString(),
          DateTime.toDate(later).toISOString(),
        );
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails UserNotFound when the user isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const exit = yield* Effect.exit(repo.updateOne(alice));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("remove", () => {
    it.effect("deletes the row", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        yield* repo.deleteOne(alice.id);
        const exit = yield* Effect.exit(repo.findOneById(alice.id));
        deepStrictEqual(Exit.isFailure(exit), true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails UserNotFound when the user isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const exit = yield* Effect.exit(repo.deleteOne(aliceId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
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
          repo.insertOne(alice).pipe(Database.TransactionContext.provide(tx)),
        );
        const found = yield* repo.findOneByEmail(alice.email);
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
              yield* repo.insertOne(alice).pipe(Database.TransactionContext.provide(tx));
              return yield* Effect.fail(new UserNotFound({ userId: bobId }));
            }),
          ),
        );
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
        const after = yield* repo.findOneByEmail(alice.email);
        deepStrictEqual(Option.isNone(after), true);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
