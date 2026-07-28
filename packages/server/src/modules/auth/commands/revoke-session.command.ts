import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { SessionId } from "@/modules/auth/domain/session/session.id.js";

// Dispatched by the logout endpoint to revoke an active session. The endpoint reads the
// session id from the cookie and dispatches; this command does the domain write so the
// endpoint never touches `SessionRepository` directly (per the
// `outbound-ports-private-to-use-cases` rule).
//
// Idempotent, and declared with no failure channel: revoking a missing or already-revoked
// session is a success, because logout must succeed regardless of session state. Transient DB
// failure is swallowed for the same reason (we'd rather let the caller's cookie be cleared and
// the OIDC end-session URL be hit than 503 a logout); the session's TTL eventually expires.
export const RevokeSession = Command.make("RevokeSessionCommand", {
  payload: { sessionId: SessionId },
  success: Schema.Void,
});
export type RevokeSessionPayload = Command.Payload<typeof RevokeSession>;
