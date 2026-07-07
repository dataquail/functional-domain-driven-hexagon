import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type SessionRepository } from "@/modules/auth/domain/ports/repositories/session.repository.js";
import {
  type SessionExpired,
  type SessionNotFound,
  type SessionRevoked,
} from "@/modules/auth/domain/session.errors.js";
import { SessionId } from "@/modules/auth/domain/session.id.js";
import { type SessionRoot } from "@/modules/auth/domain/session.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

export const FindSessionQuery = Schema.TaggedStruct("FindSessionQuery", {
  sessionId: SessionId,
});
export type FindSessionQuery = typeof FindSessionQuery.Type;

// SessionId is a UUID — opaque enough for spans, not tied to PII directly.
export const findSessionQuerySpanAttributes: SpanAttributesExtractor<FindSessionQuery> = (q) => ({
  "auth.session.id": q.sessionId,
});

// Raw handler effect — `SessionRepository` is discharged by the wrap in
// `auth-query-handlers.ts`; the bus-registered output type lives there.
export type FindSessionOutput = Effect.Effect<
  SessionRoot,
  SessionNotFound | SessionExpired | SessionRevoked | PersistenceUnavailable,
  SessionRepository
>;
