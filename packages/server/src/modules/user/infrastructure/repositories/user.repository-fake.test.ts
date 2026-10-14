import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user/user.errors";
import { UserRepository } from "@/modules/user/domain/user/user.repository";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object";

import { UserRepositoryFake } from "./user.repository-fake";

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

const provide = Effect.provide(UserRepositoryFake);

describe("UserRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores the user and makes it findable by id", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insertOne(alice);

        const found = yield* Effect.map(
          repo.findOne(UserSpecifications.withId(alice.id)),
          Option.getOrThrow,
        );

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
          address: Option.some(address),
          now,
        }).user;

        const error = yield* Effect.flip(repo.insertOne(clashing));

        assertTrue(Schema.is(UserAlreadyExists)(error));
        deepStrictEqual(error.email, alice.email);
      }).pipe(provide),
    );
  });

  describe("findOne", () => {
    it.effect("returns null for an unknown id (absence is not an error)", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const found = yield* repo.findOne(UserSpecifications.withId(aliceId));
        assertNone(found);
      }).pipe(provide),
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
      }).pipe(provide),
    );

    it.effect("returns null when no user has the email", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const found = yield* repo.findOne(UserSpecifications.withEmail("nobody@example.com"));
        assertNone(found);
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

        const found = yield* Effect.map(
          repo.findOne(UserSpecifications.withId(alice.id)),
          Option.getOrThrow,
        );

        deepStrictEqual(
          Option.map(found.address, (stored) => stored.country),
          Option.some("Canada"),
        );
        deepStrictEqual(found.updatedAt, later);
      }).pipe(provide),
    );

    it.effect("fails UserNotFound when the user isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const error = yield* Effect.flip(repo.updateOne(alice));

        deepStrictEqual(Schema.is(UserNotFound)(error), true);
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
        assertNone(found);
      }).pipe(provide),
    );

    it.effect("fails UserNotFound when the user isn't stored", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const error = yield* Effect.flip(repo.deleteOne(aliceId));

        deepStrictEqual(Schema.is(UserNotFound)(error), true);
      }).pipe(provide),
    );
  });

  describe("isolation", () => {
    it.effect("each Layer acquisition gets its own store", () =>
      Effect.gen(function* () {
        const repo1 = yield* UserRepository;
        yield* repo1.insertOne(alice);
        const exists = yield* repo1.findOne(UserSpecifications.withEmail(alice.email));
        assertTrue(Option.isSome(exists));
      }).pipe(provide, (first) =>
        Effect.andThen(
          first,
          Effect.gen(function* () {
            const repo2 = yield* UserRepository;
            const empty = yield* repo2.findOne(UserSpecifications.withEmail(alice.email));
            assertNone(empty);
          }).pipe(provide),
        ),
      ),
    );
  });
});
