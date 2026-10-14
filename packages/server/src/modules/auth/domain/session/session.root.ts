import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id";

import { SessionId } from "./session.id";

export class SessionRoot extends Schema.Class<SessionRoot, { readonly brand: "SessionRoot" }>(
  "SessionRoot",
)({
  id: SessionId,
  userId: UserId,
  subject: Schema.String,
  expiresAt: Schema.DateTimeUtc,
  absoluteExpiresAt: Schema.DateTimeUtc,
  revokedAt: Schema.Option(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  lastUsedAt: Schema.DateTimeUtc,
}) {}
