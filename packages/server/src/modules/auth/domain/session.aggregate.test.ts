import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import { SessionId } from "./session-id.js";
import * as Session from "./session.aggregate.js";

const sessionId = SessionId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

describe("Session.create", () => {
  it("populates required fields and starts unrevoked", () => {
    const session = Session.create({
      id: sessionId,
      userId,
      subject: "zitadel-sub-1",
      now,
      ttlSeconds: 3600,
      absoluteTtlSeconds: 43200,
    });
    deepStrictEqual(session.id, sessionId);
    deepStrictEqual(session.userId, userId);
    deepStrictEqual(session.subject, "zitadel-sub-1");
    deepStrictEqual(session.revokedAt, null);
    deepStrictEqual(session.createdAt, now);
    deepStrictEqual(session.lastUsedAt, now);
  });

  it("computes expiresAt as now + ttlSeconds", () => {
    const session = Session.create({
      id: sessionId,
      userId,
      subject: "s",
      now,
      ttlSeconds: 3600,
      absoluteTtlSeconds: 43200,
    });
    const expected = DateTime.add(now, { seconds: 3600 });
    deepStrictEqual(session.expiresAt, expected);
  });

  it("computes absoluteExpiresAt as now + absoluteTtlSeconds and is later than expiresAt", () => {
    const session = Session.create({
      id: sessionId,
      userId,
      subject: "s",
      now,
      ttlSeconds: 3600,
      absoluteTtlSeconds: 43200,
    });
    const expected = DateTime.add(now, { seconds: 43200 });
    deepStrictEqual(session.absoluteExpiresAt, expected);
    deepStrictEqual(DateTime.lessThan(session.expiresAt, session.absoluteExpiresAt), true);
  });
});

describe("Session.touch", () => {
  const seed = Session.create({
    id: sessionId,
    userId,
    subject: "s",
    now,
    ttlSeconds: 3600,
    absoluteTtlSeconds: 43200,
  });

  it("advances expiresAt to now + ttlSeconds and updates lastUsedAt", () => {
    const later = DateTime.add(now, { seconds: 1800 });
    const touched = Session.touch({ session: seed, now: later, ttlSeconds: 3600 });
    deepStrictEqual(touched.expiresAt, DateTime.add(later, { seconds: 3600 }));
    deepStrictEqual(touched.lastUsedAt, later);
  });

  it("clamps expiresAt to absoluteExpiresAt when the new window would exceed the cap", () => {
    const nearCap = DateTime.add(now, { seconds: 43000 });
    const touched = Session.touch({ session: seed, now: nearCap, ttlSeconds: 3600 });
    deepStrictEqual(touched.expiresAt, seed.absoluteExpiresAt);
    deepStrictEqual(touched.lastUsedAt, nearCap);
  });

  it("preserves identity, ownership, subject, createdAt, absoluteExpiresAt, revokedAt", () => {
    const later = DateTime.add(now, { seconds: 60 });
    const touched = Session.touch({ session: seed, now: later, ttlSeconds: 3600 });
    deepStrictEqual(touched.id, seed.id);
    deepStrictEqual(touched.userId, seed.userId);
    deepStrictEqual(touched.subject, seed.subject);
    deepStrictEqual(touched.createdAt, seed.createdAt);
    deepStrictEqual(touched.absoluteExpiresAt, seed.absoluteExpiresAt);
    deepStrictEqual(touched.revokedAt, seed.revokedAt);
  });
});
