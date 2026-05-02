import { SessionId } from "@/modules/auth/domain/session-id.js";
import { type SessionRepository } from "@/modules/auth/domain/session-repository.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

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

export type TouchSessionOutput = Effect.Effect<void, never, SessionRepository>;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    TouchSessionCommand: {
      readonly command: TouchSessionCommand;
      readonly output: TouchSessionOutput;
    };
  }
}
