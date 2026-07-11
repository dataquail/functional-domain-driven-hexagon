import * as Schema from "effect/Schema";

import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type UserId } from "@/platform/ids/user-id.js";

export const FindSessionQuery = Schema.TaggedStruct("FindSessionQuery", {
  sessionId: SessionId,
});
export type FindSessionQuery = typeof FindSessionQuery.Type;

// The read model the auth middleware needs: the opaque principal ids,
// nothing else. Lifecycle (revoked/expired) is enforced by the handler
// and surfaced as the errors below, not carried on the view.
export type SessionView = {
  readonly id: SessionId;
  readonly userId: UserId;
};

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

// SessionId is a UUID — opaque enough for spans, not tied to PII directly.
export const findSessionQuerySpanAttributes: SpanAttributesExtractor<FindSessionQuery> = (q) => ({
  "auth.session.id": q.sessionId,
});
