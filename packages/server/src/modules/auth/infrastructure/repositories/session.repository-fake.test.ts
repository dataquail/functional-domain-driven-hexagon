import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { SessionNotFound } from "@/modules/auth/domain/session/session.errors.js";
import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import { SessionRootOps } from "@/modules/auth/domain/session/session.root-ops.js";
import { SessionSpecifications } from "@/modules/auth/domain/session/session.specification.js";

import { SessionRepositoryFake } from "./session.repository-fake.js";

const idA = SessionId.make("11111111-1111-1111-1111-111111111111");
const idMissing = SessionId.make("99999999-9999-9999-9999-999999999999");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

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

      const found = yield* repo
        .findOne(SessionSpecifications.withId(idA))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(found.id, idA);
      assertNone(found.revokedAt);
    }).pipe(provide),
  );

  it.effect("findOne returns null for an unknown id (absence is not an error)", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const found = yield* repo.findOne(SessionSpecifications.withId(idMissing));
      assertNone(found);
    }).pipe(provide),
  );

  it.effect("delete marks the session as revoked (soft-delete)", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      yield* repo.insertOne(makeSession(idA));
      yield* repo.deleteOne(idA);

      const found = yield* repo
        .findOne(SessionSpecifications.withId(idA))
        .pipe(Effect.flatMap(Effect.fromOption));

      assertTrue(Option.isSome(found.revokedAt));
    }).pipe(provide),
  );

  it.effect("delete fails SessionNotFound on a missing id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      assertInstanceOf(yield* Effect.flip(repo.deleteOne(idMissing)), SessionNotFound);
    }).pipe(provide),
  );

  it.effect("delete: a second delete on the same row fails NotFound (matches live impl)", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      yield* repo.insertOne(makeSession(idA));
      yield* repo.deleteOne(idA);
      assertInstanceOf(yield* Effect.flip(repo.deleteOne(idA)), SessionNotFound);
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

      const found = yield* repo
        .findOne(SessionSpecifications.withId(idA))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(found.expiresAt, touched.expiresAt);
      deepStrictEqual(found.lastUsedAt, touched.lastUsedAt);
      deepStrictEqual(found.createdAt, seed.createdAt);
      deepStrictEqual(found.absoluteExpiresAt, seed.absoluteExpiresAt);
    }).pipe(provide),
  );

  it.effect("update fails SessionNotFound on a missing id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      assertInstanceOf(yield* Effect.flip(repo.updateOne(makeSession(idMissing))), SessionNotFound);
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
      const error = yield* Effect.flip(repo.updateOne(touched));
      assertInstanceOf(error, SessionNotFound);
    }).pipe(provide),
  );
});
