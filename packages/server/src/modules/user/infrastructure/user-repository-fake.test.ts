import { UserId } from "@/modules/user/domain/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { UserAlreadyExists, UserNotFound } from "../domain/user-errors.js";
import { UserRepository } from "../domain/user-repository.js";
import * as User from "../domain/user.aggregate.js";
import { Address } from "../domain/value-objects/address.js";
import { UserRepositoryFake } from "./user-repository-fake.js";

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

const provide = Effect.provide(UserRepositoryFake);

describe("UserRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores the user and makes it findable by id", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insert(alice);
        const found = yield* repo.findById(alice.id);
        deepStrictEqual(found.id, alice.id);
        deepStrictEqual(found.email, alice.email);
      }).pipe(provide),
    );

    it.effect("fails UserAlreadyExists when email is already taken", () =>
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
      }).pipe(provide),
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
      }).pipe(provide),
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
      }).pipe(provide),
    );

    it.effect("returns None when no user has the email", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        const result = yield* repo.findByEmail("nobody@example.com");
        deepStrictEqual(Option.isNone(result), true);
      }).pipe(provide),
    );
  });

  describe("update", () => {
    it.effect("overwrites the stored user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insert(alice);
        const { user: admin } = User.makeAdmin(alice, { now: later });
        yield* repo.update(admin);
        const found = yield* repo.findById(alice.id);
        deepStrictEqual(found.role, "admin");
        deepStrictEqual(found.updatedAt, later);
      }).pipe(provide),
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
      }).pipe(provide),
    );
  });

  describe("remove", () => {
    it.effect("removes the user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository;
        yield* repo.insert(alice);
        yield* repo.remove(alice.id);
        const exit = yield* Effect.exit(repo.findById(alice.id));
        deepStrictEqual(Exit.isFailure(exit), true);
      }).pipe(provide),
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
      }).pipe(provide),
    );
  });

  describe("isolation", () => {
    it.effect("each Layer acquisition gets its own store", () =>
      Effect.gen(function* () {
        const repo1 = yield* UserRepository;
        yield* repo1.insert(alice);
        const exists = yield* repo1.findByEmail(alice.email);
        deepStrictEqual(Option.isSome(exists), true);
      }).pipe(provide, (first) =>
        Effect.zipRight(
          first,
          Effect.gen(function* () {
            const repo2 = yield* UserRepository;
            const empty = yield* repo2.findByEmail(alice.email);
            deepStrictEqual(Option.isNone(empty), true);
          }).pipe(provide),
        ),
      ),
    );
  });
});
