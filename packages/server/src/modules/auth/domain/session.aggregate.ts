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
