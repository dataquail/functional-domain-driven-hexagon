import * as Schema from "effect/Schema";

import { SessionId } from "./session.id.js";

export class SessionNotFound extends Schema.TaggedErrorClass<SessionNotFound>("SessionNotFound")(
  "SessionNotFound",
  { sessionId: SessionId },
) {}

export class SessionExpired extends Schema.TaggedErrorClass<SessionExpired>("SessionExpired")(
  "SessionExpired",
  { sessionId: SessionId },
) {}

export class SessionRevoked extends Schema.TaggedErrorClass<SessionRevoked>("SessionRevoked")(
  "SessionRevoked",
  { sessionId: SessionId },
) {}

export class AuthIdentityNotFound extends Schema.TaggedErrorClass<AuthIdentityNotFound>(
  "AuthIdentityNotFound",
)("AuthIdentityNotFound", { subject: Schema.String }) {}
