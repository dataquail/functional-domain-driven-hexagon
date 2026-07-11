import * as Schema from "effect/Schema";

import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// Sliding-TTL refresh, dispatched by the auth middleware after a successful
// `FindSessionQuery`. The handler does its own throttle + revocation guard,
// so the command is safe to fire on every request — when nothing needs to
// change, it's a no-op.
export const TouchSessionCommand = Schema.TaggedStruct("TouchSessionCommand", {
  sessionId: SessionId,
  ttlSeconds: Schema.Number,
  thresholdSeconds: Schema.Number,
});
export type TouchSessionCommand = typeof TouchSessionCommand.Type;

export const touchSessionCommandSpanAttributes: SpanAttributesExtractor<TouchSessionCommand> = (
  c,
) => ({
  "auth.session.id": c.sessionId,
});
