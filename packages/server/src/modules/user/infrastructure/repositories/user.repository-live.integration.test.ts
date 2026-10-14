import { deepStrictEqual } from "node:assert";

import { describe } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.js";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification.js";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/repositories/user.repository-live.js";
import { describeIntegration } from "@/test-utils/server-test-runtime.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2025-02-01T00:00:00Z");

const address = AddressValueObject.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const alice = UserRootOps.create({
  id: aliceId,
  email: "alice@example.com",
  address: Option.some(address),
  now,
}).user;

const TestLayer = UserRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "UserRepositoryLive (integration)",
  { layer: TestLayer, tables: ["user.users"] },
  (it) => {
    describe("insert", () => {
      it.effect("persists the user and decodes it back via findOne(withId)", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          yield* repo.insertOne(alice);

          const found = yield* Effect.map(
            repo.findOne(UserSpecifications.withId(alice.id)),
            Option.getOrThrow,
          );

          deepStrictEqual(found.id, alice.id);
          deepStrictEqual(found.email, alice.email);

          const storedAddress = Option.getOrThrow(found.address);
          deepStrictEqual(storedAddress.country, "USA");
          deepStrictEqual(storedAddress.street, "123 Main St");
          deepStrictEqual(storedAddress.postalCode, "12345");
        }),
      );

      it.effect(
        "fails UserAlreadyExists on duplicate email (unique violation → domain error)",
        () =>
          Effect.gen(function* () {
            const repo = yield* UserRepository;
            yield* repo.insertOne(alice);

            const clashing = UserRootOps.create({
              id: bobId,
              email: alice.email,
              address: Option.some(address),
              now,
            }).user;

            const error = yield* Effect.flip(repo.insertOne(clashing));

            assertTrue(Schema.is(UserAlreadyExists)(error));
            deepStrictEqual(error.email, alice.email);
          }),
      );
    });

    describe("findOne", () => {
      it.effect("returns null for an unknown id (absence is not an error)", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          const found = yield* repo.findOne(UserSpecifications.withId(aliceId));
          assertNone(found);
        }),
      );

      it.effect("returns the user when the email matches", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          yield* repo.insertOne(alice);

          const found = yield* Effect.map(
            repo.findOne(UserSpecifications.withEmail("alice@example.com")),
            Option.getOrThrow,
          );

          deepStrictEqual(found.id, alice.id);
        }),
      );

      it.effect("returns null when no user has the email", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          const found = yield* repo.findOne(UserSpecifications.withEmail("nobody@example.com"));
          assertNone(found);
        }),
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

          const found = yield* Effect.map(
            repo.findOne(UserSpecifications.withId(alice.id)),
            Option.getOrThrow,
          );

          deepStrictEqual(
            Option.map(found.address, (stored) => stored.country),
            Option.some("Canada"),
          );
          deepStrictEqual(
            DateTime.toDate(found.updatedAt).toISOString(),
            DateTime.toDate(later).toISOString(),
          );
        }),
      );

      it.effect("fails UserNotFound when the user isn't stored", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          const error = yield* Effect.flip(repo.updateOne(alice));

          deepStrictEqual(Schema.is(UserNotFound)(error), true);
        }),
      );
    });

    describe("remove", () => {
      it.effect("deletes the row", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          yield* repo.insertOne(alice);
          yield* repo.deleteOne(alice.id);
          const found = yield* repo.findOne(UserSpecifications.withId(alice.id));
          assertNone(found);
        }),
      );

      it.effect("fails UserNotFound when the user isn't stored", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          const error = yield* Effect.flip(repo.deleteOne(aliceId));

          deepStrictEqual(Schema.is(UserNotFound)(error), true);
        }),
      );
    });

    describe("transaction", () => {
      it.effect("commits inserts when the body succeeds", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          const sql = yield* Database.Database;
          yield* sql.withTransaction(repo.insertOne(alice));
          const found = yield* repo.findOne(UserSpecifications.withEmail(alice.email));
          assertTrue(Option.isSome(found));
        }),
      );

      it.effect("rolls back inserts when the body fails (surfaces typed error)", () =>
        Effect.gen(function* () {
          const repo = yield* UserRepository;
          const sql = yield* Database.Database;

          const error = yield* Effect.flip(
            sql.withTransaction(
              Effect.gen(function* () {
                yield* repo.insertOne(alice);

                return yield* new UserNotFound({ userId: bobId });
              }),
            ),
          );

          deepStrictEqual(Schema.is(UserNotFound)(error), true);

          const after = yield* repo.findOne(UserSpecifications.withEmail(alice.email));
          assertNone(after);
        }),
      );
    });
  },
);
