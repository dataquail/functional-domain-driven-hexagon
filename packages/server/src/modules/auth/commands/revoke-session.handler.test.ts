import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { revokeSessionHandler } from "@/modules/auth/commands/revoke-session.handler.js";
import { SessionRevoked } from "@/modules/auth/domain/session/session.errors.js";
import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import { SessionRootOps } from "@/modules/auth/domain/session/session.root-ops.js";
import { SessionSpecifications } from "@/modules/auth/domain/session/session.specification.js";
import { SessionRepositoryFake } from "@/modules/auth/infrastructure/repositories/session.repository-fake.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

const sessionId = SessionId.make("33333333-3333-3333-3333-333333333333");
const userId = UserId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const seedSession = () =>
  Effect.gen(function* () {
    const repo = yield* SessionRepository;
    const session = SessionRootOps.create({
      id: sessionId,
      userId,
      subject: "zitadel-sub",
      now,
      ttlSeconds: 3600,
      absoluteTtlSeconds: 43200,
    });
    yield* repo.insertOne(session);
  });

const provide = Effect.provide(SessionRepositoryFake);

const deleteOneFailingWith = (failure: SessionRevoked | PersistenceUnavailable) =>
  Layer.effect(
    SessionRepository,
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      return SessionRepository.of({ ...repo, deleteOne: () => failure });
    }),
  ).pipe(Layer.provide(SessionRepositoryFake));

describe("revokeSessionHandler", () => {
  it.effect("revokes an active session", () =>
    Effect.gen(function* () {
      yield* seedSession();
      yield* revokeSessionHandler({ sessionId });
      const repo = yield* SessionRepository;
      const found = yield* repo.findOne(SessionSpecifications.withId(sessionId));
      ok(found !== null);
      ok(Option.isSome(Option.fromNullishOr(found.revokedAt)));
    }).pipe(provide),
  );

  it.effect("is idempotent on a missing session (no error)", () =>
    Effect.gen(function* () {
      yield* revokeSessionHandler({ sessionId });
      // No assertion — the assertion is that the command's typed error
      // channel is `never`, so any failure would surface as a defect
      // and crash the test. Reaching here means the SessionNotFound
      // case was swallowed.
      deepStrictEqual(true, true);
    }).pipe(provide),
  );

  it.effect("is idempotent on an already-revoked session", () =>
    Effect.gen(function* () {
      yield* seedSession();
      yield* revokeSessionHandler({ sessionId });
      yield* revokeSessionHandler({ sessionId });
      deepStrictEqual(true, true);
    }).pipe(provide),
  );

  it.effect("succeeds when the repository reports the session already revoked", () =>
    revokeSessionHandler({ sessionId }).pipe(
      Effect.provide(deleteOneFailingWith(new SessionRevoked({ sessionId }))),
    ),
  );

  it.effect("succeeds through a persistence outage — signing out never fails the caller", () =>
    revokeSessionHandler({ sessionId }).pipe(
      Effect.provide(deleteOneFailingWith(new PersistenceUnavailable({ message: "down" }))),
    ),
  );
});
