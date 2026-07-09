import * as Schema from "effect/Schema";

import { SessionId } from "@/modules/auth/domain/session.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

export const FindSessionQuery = Schema.TaggedStruct("FindSessionQuery", {
  sessionId: SessionId,
});
export type FindSessionQuery = typeof FindSessionQuery.Type;

// SessionId is a UUID — opaque enough for spans, not tied to PII directly.
export const findSessionQuerySpanAttributes: SpanAttributesExtractor<FindSessionQuery> = (q) => ({
  "auth.session.id": q.sessionId,
});
