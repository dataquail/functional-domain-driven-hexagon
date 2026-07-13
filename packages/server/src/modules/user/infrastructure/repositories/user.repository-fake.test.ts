import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.js";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification.js";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.js";
import { UserId } from "@/platform/ids/user-id.js";

import { UserRepositoryFake } from "./user.repository-fake.js";

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

const provide = Effect.provide(UserRepositoryFake);

describe("UserRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores the user and makes it findable by id", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        const found = yield* repo.findOne(UserSpecifications.withId(alice.id));
        if (found === null) throw new Error("expected stored user");
        deepStrictEqual(found.id, alice.id);
        deepStrictEqual(found.email, alice.email);
      }).pipe(provide),
    );

    it.effect("fails UserAlreadyExists when email is already taken", () =>
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
          const error = Cause.hasFails(exit.cause)
            ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
            : null;
          deepStrictEqual(error instanceof UserAlreadyExists, true);
          deepStrictEqual((error as UserAlreadyExists).email, alice.email);
        }
      }).pipe(provide),
    );
  });

  describe("findOne", () => {
    it.effect("returns null for an unknown id (absence is not an error)", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const found = yield* repo.findOne(UserSpecifications.withId(aliceId));
        deepStrictEqual(found, null);
      }).pipe(provide),
    );

    it.effect("returns the user when the email matches", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        const found = yield* repo.findOne(UserSpecifications.withEmail("alice@example.com"));
        if (found === null) throw new Error("expected stored user");
        deepStrictEqual(found.id, alice.id);
      }).pipe(provide),
    );

    it.effect("returns null when no user has the email", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const found = yield* repo.findOne(UserSpecifications.withEmail("nobody@example.com"));
        deepStrictEqual(found, null);
      }).pipe(provide),
    );
  });

  describe("update", () => {
    it.effect("overwrites the stored user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        const { user: updated } = UserRootOps.updateAddress(alice, {
          country: "Canada",
          now: later,
        });
        yield* repo.updateOne(updated);
        const found = yield* repo.findOne(UserSpecifications.withId(alice.id));
        if (found === null) throw new Error("expected stored user");
        deepStrictEqual(found.address?.country, "Canada");
        deepStrictEqual(found.updatedAt, later);
      }).pipe(provide),
    );

    it.effect("fails UserNotFound when the user isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const exit = yield* Effect.exit(repo.updateOne(alice));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause)
            ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
            : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
      }).pipe(provide),
    );
  });

  describe("remove", () => {
    it.effect("removes the user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);
        yield* repo.deleteOne(alice.id);
        const found = yield* repo.findOne(UserSpecifications.withId(alice.id));
        deepStrictEqual(found, null);
      }).pipe(provide),
    );

    it.effect("fails UserNotFound when the user isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const exit = yield* Effect.exit(repo.deleteOne(aliceId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause)
            ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
            : null;
          deepStrictEqual(error instanceof UserNotFound, true);
        }
      }).pipe(provide),
    );
  });

  describe("isolation", () => {
    it.effect("each Layer acquisition gets its own store", () =>
      Effect.gen(function* () {
        const repo1 = yield* UserRepository;
        yield* repo1.insertOne(alice);
        const exists = yield* repo1.findOne(UserSpecifications.withEmail(alice.email));
        deepStrictEqual(exists !== null, true);
      }).pipe(provide, (first) =>
        Effect.andThen(
          first,
          Effect.gen(function* () {
            const repo2 = yield* UserRepository;
            const empty = yield* repo2.findOne(UserSpecifications.withEmail(alice.email));
            deepStrictEqual(empty, null);
          }).pipe(provide),
        ),
      ),
    );
  });
});
