import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { SessionNotFound } from "../domain/session-errors.js";
import { SessionId } from "../domain/session-id.js";
import { SessionRepository } from "../domain/session-repository.js";
import * as Session from "../domain/session.aggregate.js";
import { SessionRepositoryFake } from "./session-repository-fake.js";

const idA = SessionId.make("11111111-1111-1111-1111-111111111111");
const idMissing = SessionId.make("99999999-9999-9999-9999-999999999999");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const makeSession = (id: SessionId) =>
  Session.create({
    id,
    userId,
    subject: "subject-1",
    now,
    ttlSeconds: 3600,
    absoluteTtlSeconds: 43200,
  });

const provide = Effect.provide(SessionRepositoryFake);

describe("SessionRepositoryFake", () => {
  it.effect("insert + findById round-trip", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      yield* repo.insert(makeSession(idA));
      const found = yield* repo.findById(idA);
      deepStrictEqual(found.id, idA);
      deepStrictEqual(found.revokedAt, null);
    }).pipe(provide),
  );

  it.effect("findById fails SessionNotFound for an unknown id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const exit = yield* Effect.exit(repo.findById(idMissing));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof SessionNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("revoke marks the session as revoked", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      yield* repo.insert(makeSession(idA));
      yield* repo.revoke(idA);
      const found = yield* repo.findById(idA);
      deepStrictEqual(found.revokedAt !== null, true);
    }).pipe(provide),
  );

  it.effect("revoke fails SessionNotFound on a missing id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const exit = yield* Effect.exit(repo.revoke(idMissing));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );

  it.effect("revoke is idempotent: a second revoke fails NotFound (matches live impl)", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      yield* repo.insert(makeSession(idA));
      yield* repo.revoke(idA);
      const exit = yield* Effect.exit(repo.revoke(idA));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );

  it.effect("update advances expiresAt and lastUsedAt for an unrevoked session", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const seed = makeSession(idA);
      yield* repo.insert(seed);
      const later = DateTime.add(now, { seconds: 1800 });
      const touched = Session.touch({ session: seed, now: later, ttlSeconds: 3600 });
      yield* repo.update(touched);
      const found = yield* repo.findById(idA);
      deepStrictEqual(found.expiresAt, touched.expiresAt);
      deepStrictEqual(found.lastUsedAt, touched.lastUsedAt);
      deepStrictEqual(found.createdAt, seed.createdAt);
      deepStrictEqual(found.absoluteExpiresAt, seed.absoluteExpiresAt);
    }).pipe(provide),
  );

  it.effect("update fails SessionNotFound on a missing id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const exit = yield* Effect.exit(repo.update(makeSession(idMissing)));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof SessionNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("update fails SessionNotFound when the session is already revoked", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const seed = makeSession(idA);
      yield* repo.insert(seed);
      yield* repo.revoke(idA);
      const later = DateTime.add(now, { seconds: 1800 });
      const touched = Session.touch({ session: seed, now: later, ttlSeconds: 3600 });
      const exit = yield* Effect.exit(repo.update(touched));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof SessionNotFound, true);
      }
    }).pipe(provide),
  );
});
