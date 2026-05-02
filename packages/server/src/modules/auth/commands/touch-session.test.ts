import { TouchSessionCommand } from "@/modules/auth/commands/touch-session-command.js";
import { touchSession } from "@/modules/auth/commands/touch-session.js";
import { SessionId } from "@/modules/auth/domain/session-id.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import * as Session from "@/modules/auth/domain/session.aggregate.js";
import { SessionRepositoryFake } from "@/modules/auth/infrastructure/session-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

const sessionId = SessionId.make("33333333-3333-3333-3333-333333333333");
const userId = UserId.make("44444444-4444-4444-4444-444444444444");

const seedSession = (lastUsedAt: DateTime.Utc) =>
  Effect.gen(function* () {
    const repo = yield* SessionRepository;
    // Build via Session.create then re-stamp lastUsedAt to the case's value
    // so the throttle check is the variable under test.
    const base = Session.create({
      id: sessionId,
      userId,
      subject: "zitadel-sub",
      now: lastUsedAt,
      ttlSeconds: 3600,
      absoluteTtlSeconds: 43200,
    });
    yield* repo.insert(base);
    return base;
  });

const cmd = TouchSessionCommand.make({
  sessionId,
  ttlSeconds: 3600,
  thresholdSeconds: 60,
});

describe("touchSession", () => {
  it.live("advances expiresAt and lastUsedAt when threshold has elapsed", () =>
    Effect.gen(function* () {
      const farPast = DateTime.unsafeMake(new Date("2000-01-01T00:00:00Z"));
      const seed = yield* seedSession(farPast);
      yield* touchSession(cmd);
      const repo = yield* SessionRepository;
      const after = yield* repo.findById(sessionId);
      deepStrictEqual(DateTime.greaterThan(after.lastUsedAt, seed.lastUsedAt), true);
      deepStrictEqual(DateTime.greaterThan(after.expiresAt, seed.expiresAt), true);
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );

  it.live("is a no-op when the session was used inside the throttle window", () =>
    Effect.gen(function* () {
      const justNow = yield* DateTime.now;
      const seed = yield* seedSession(justNow);
      yield* touchSession(cmd);
      const repo = yield* SessionRepository;
      const after = yield* repo.findById(sessionId);
      deepStrictEqual(after.lastUsedAt, seed.lastUsedAt);
      deepStrictEqual(after.expiresAt, seed.expiresAt);
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );

  it.effect("does not fail when the session does not exist (benign race)", () =>
    Effect.gen(function* () {
      yield* touchSession(cmd);
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );

  it.live("does not advance a revoked session", () =>
    Effect.gen(function* () {
      const farPast = DateTime.unsafeMake(new Date("2000-01-01T00:00:00Z"));
      const seed = yield* seedSession(farPast);
      const repo = yield* SessionRepository;
      yield* repo.revoke(sessionId);
      yield* touchSession(cmd);
      const after = yield* repo.findById(sessionId);
      deepStrictEqual(after.expiresAt, seed.expiresAt);
      deepStrictEqual(after.lastUsedAt, seed.lastUsedAt);
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );
});
