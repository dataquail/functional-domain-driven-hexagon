import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { SessionNotFound } from "@/modules/auth/domain/session/session.errors.js";
import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import { SessionRootOps } from "@/modules/auth/domain/session/session.root-ops.js";
import { SessionSpecifications } from "@/modules/auth/domain/session/session.specification.js";
import { UserId } from "@/platform/ids/user-id.js";

import { SessionRepositoryFake } from "./session.repository-fake.js";

const idA = SessionId.make("11111111-1111-1111-1111-111111111111");
const idMissing = SessionId.make("99999999-9999-9999-9999-999999999999");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const makeSession = (id: SessionId) =>
  SessionRootOps.create({
    id,
    userId,
    subject: "subject-1",
    now,
    ttlSeconds: 3600,
    absoluteTtlSeconds: 43200,
  });

const provide = Effect.provide(SessionRepositoryFake);

describe("SessionRepositoryFake", () => {
  it.effect("insert + findOne(withId) round-trip", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      yield* repo.insertOne(makeSession(idA));
      const found = yield* repo.findOne(SessionSpecifications.withId(idA));
      if (found === null) throw new Error("expected a session");
      deepStrictEqual(found.id, idA);
      deepStrictEqual(found.revokedAt, null);
    }).pipe(provide),
  );

  it.effect("findOne returns null for an unknown id (absence is not an error)", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const found = yield* repo.findOne(SessionSpecifications.withId(idMissing));
      deepStrictEqual(found, null);
    }).pipe(provide),
  );

  it.effect("delete marks the session as revoked (soft-delete)", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      yield* repo.insertOne(makeSession(idA));
      yield* repo.deleteOne(idA);
      const found = yield* repo.findOne(SessionSpecifications.withId(idA));
      if (found === null) throw new Error("expected a session");
      deepStrictEqual(found.revokedAt !== null, true);
    }).pipe(provide),
  );

  it.effect("delete fails SessionNotFound on a missing id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const exit = yield* Effect.exit(repo.deleteOne(idMissing));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );

  it.effect("delete: a second delete on the same row fails NotFound (matches live impl)", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      yield* repo.insertOne(makeSession(idA));
      yield* repo.deleteOne(idA);
      const exit = yield* Effect.exit(repo.deleteOne(idA));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );

  it.effect("update advances expiresAt and lastUsedAt for an unrevoked session", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const seed = makeSession(idA);
      yield* repo.insertOne(seed);
      const later = DateTime.add(now, { seconds: 1800 });
      const touched = SessionRootOps.touch({ session: seed, now: later, ttlSeconds: 3600 });
      yield* repo.updateOne(touched);
      const found = yield* repo.findOne(SessionSpecifications.withId(idA));
      if (found === null) throw new Error("expected a session");
      deepStrictEqual(found.expiresAt, touched.expiresAt);
      deepStrictEqual(found.lastUsedAt, touched.lastUsedAt);
      deepStrictEqual(found.createdAt, seed.createdAt);
      deepStrictEqual(found.absoluteExpiresAt, seed.absoluteExpiresAt);
    }).pipe(provide),
  );

  it.effect("update fails SessionNotFound on a missing id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const exit = yield* Effect.exit(repo.updateOne(makeSession(idMissing)));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof SessionNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("update fails SessionNotFound when the session is already revoked", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const seed = makeSession(idA);
      yield* repo.insertOne(seed);
      yield* repo.deleteOne(idA);
      const later = DateTime.add(now, { seconds: 1800 });
      const touched = SessionRootOps.touch({ session: seed, now: later, ttlSeconds: 3600 });
      const exit = yield* Effect.exit(repo.updateOne(touched));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof SessionNotFound, true);
      }
    }).pipe(provide),
  );
});
