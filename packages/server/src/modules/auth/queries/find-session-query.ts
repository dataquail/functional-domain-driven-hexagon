import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type Session } from "@/modules/auth/domain/session.aggregate.js";
import {
  type SessionExpired,
  type SessionNotFound,
  type SessionRevoked,
} from "@/modules/auth/domain/session-errors.js";
import { SessionId } from "@/modules/auth/domain/session-id.js";
import { type SessionRepository } from "@/modules/auth/domain/session-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";

export const FindSessionQuery = Schema.TaggedStruct("FindSessionQuery", {
  sessionId: SessionId,
});
export type FindSessionQuery = typeof FindSessionQuery.Type;

// SessionId is a UUID — opaque enough for spans, not tied to PII directly.
export const findSessionQuerySpanAttributes: SpanAttributesExtractor<FindSessionQuery> = (q) => ({
  "auth.session.id": q.sessionId,
});

export type FindSessionOutput = Effect.Effect<
  Session,
  SessionNotFound | SessionExpired | SessionRevoked | PersistenceUnavailable,
  SessionRepository
>;

declare module "@/platform/ddd/query-bus.js" {
  interface QueryRegistry {
    FindSessionQuery: {
      readonly query: FindSessionQuery;
      readonly output: FindSessionOutput;
    };
  }
}
