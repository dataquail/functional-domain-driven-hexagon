import { PersistenceUnavailable, Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { UserId } from "@/platform/ids/user-id.js";

// The read model the auth middleware needs: the opaque principal ids,
// nothing else. Lifecycle (revoked/expired) is enforced by the handler
// and surfaced as the errors below, not carried on the view.
export const SessionView = Schema.Struct({
  id: SessionId,
  userId: UserId,
});
export type SessionView = typeof SessionView.Type;

// Read-side lifecycle outcomes. The write-side `Session` aggregate owns
// its own equivalents (revoke path); these are query-owned so the read
// path stays off the domain. The auth middleware collapses all three to
// a 401 — the distinct tags exist for observability.
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

export const FindSessionQuery = Query.make("FindSessionQuery", {
  payload: { sessionId: SessionId },
  success: SessionView,
  failure: Schema.Union([SessionNotFound, SessionExpired, SessionRevoked, PersistenceUnavailable]),
});
export type FindSessionPayload = Query.Payload<typeof FindSessionQuery>;
