import * as DateTime from "effect/DateTime";

import { type UserId } from "@/platform/ids/user-id.js";

import { type SessionId } from "./session.id.js";
import { SessionRoot } from "./session.root.js";

export type CreateInput = {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly subject: string;
  readonly now: DateTime.Utc;
  readonly ttlSeconds: number;
  readonly absoluteTtlSeconds: number;
};

const create = (input: CreateInput): SessionRoot =>
  SessionRoot.make({
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
  readonly session: SessionRoot;
  readonly now: DateTime.Utc;
  readonly ttlSeconds: number;
};

// Sliding refresh: advance `expiresAt` to `now + ttlSeconds`, clamped to the
// session's hard `absoluteExpiresAt` cap, and stamp `lastUsedAt`. Pure state
// transition — the throttle decision (whether to call this at all) lives in
// the use case, and revocation is enforced by the repository's WHERE clause.
const touch = (input: TouchInput): SessionRoot => {
  const candidate = DateTime.add(input.now, { seconds: input.ttlSeconds });
  const expiresAt = DateTime.isLessThan(candidate, input.session.absoluteExpiresAt)
    ? candidate
    : input.session.absoluteExpiresAt;
  return SessionRoot.make({
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

export const SessionRootOps = { create, touch } as const;
