import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { SessionId } from "./session.id.js";

export class SessionRoot extends Schema.Class<SessionRoot>("SessionRoot")({
  id: SessionId,
  userId: UserId,
  subject: Schema.String,
  expiresAt: Schema.DateTimeUtc,
  absoluteExpiresAt: Schema.DateTimeUtc,
  revokedAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  lastUsedAt: Schema.DateTimeUtc,
}) {}
