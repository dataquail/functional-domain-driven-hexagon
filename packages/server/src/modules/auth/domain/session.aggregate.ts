import { UserId } from "@/platform/ids/user-id.js";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { SessionId } from "./session-id.js";

export class Session extends Schema.Class<Session>("Session")({
  id: SessionId,
  userId: UserId,
  subject: Schema.String,
  expiresAt: Schema.DateTimeUtc,
  absoluteExpiresAt: Schema.DateTimeUtc,
  revokedAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  lastUsedAt: Schema.DateTimeUtc,
}) {}

export type CreateInput = {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly subject: string;
  readonly now: DateTime.Utc;
  readonly ttlSeconds: number;
  readonly absoluteTtlSeconds: number;
};

export const create = (input: CreateInput): Session =>
  Session.make({
    id: input.id,
    userId: input.userId,
    subject: input.subject,
    expiresAt: DateTime.add(input.now, { seconds: input.ttlSeconds }),
    absoluteExpiresAt: DateTime.add(input.now, { seconds: input.absoluteTtlSeconds }),
    revokedAt: null,
    createdAt: input.now,
    lastUsedAt: input.now,
  });

export type TouchInput = {
  readonly session: Session;
  readonly now: DateTime.Utc;
  readonly ttlSeconds: number;
};

// Sliding refresh: advance `expiresAt` to `now + ttlSeconds`, clamped to the
// session's hard `absoluteExpiresAt` cap, and stamp `lastUsedAt`. Pure state
// transition — the throttle decision (whether to call this at all) lives in
// the use case, and revocation is enforced by the repository's WHERE clause.
export const touch = (input: TouchInput): Session => {
  const candidate = DateTime.add(input.now, { seconds: input.ttlSeconds });
  const expiresAt = DateTime.lessThan(candidate, input.session.absoluteExpiresAt)
    ? candidate
    : input.session.absoluteExpiresAt;
  return Session.make({
    id: input.session.id,
    userId: input.session.userId,
    subject: input.session.subject,
    expiresAt,
    absoluteExpiresAt: input.session.absoluteExpiresAt,
    revokedAt: input.session.revokedAt,
    createdAt: input.session.createdAt,
    lastUsedAt: input.now,
  });
};
