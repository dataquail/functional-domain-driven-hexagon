import * as Schema from "effect/Schema";
import { SessionId } from "./session-id.js";

export class SessionNotFound extends Schema.TaggedError<SessionNotFound>("SessionNotFound")(
  "SessionNotFound",
  { sessionId: SessionId },
) {}

export class SessionExpired extends Schema.TaggedError<SessionExpired>("SessionExpired")(
  "SessionExpired",
  { sessionId: SessionId },
) {}

export class SessionRevoked extends Schema.TaggedError<SessionRevoked>("SessionRevoked")(
  "SessionRevoked",
  { sessionId: SessionId },
) {}

export class AuthIdentityNotFound extends Schema.TaggedError<AuthIdentityNotFound>(
  "AuthIdentityNotFound",
)("AuthIdentityNotFound", { subject: Schema.String }) {}
