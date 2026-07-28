import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { SessionId } from "@/modules/auth/domain/session/session.id.js";

// Sliding-TTL refresh, dispatched by the auth middleware after a successful session lookup.
// The handler does its own throttle + revocation guard, so the command is safe to fire on every
// request — when nothing needs to change, it's a no-op. No failure channel: the handler swallows
// its own errors so a sliding-TTL refresh can never fail a request.
export const TouchSession = Command.make("TouchSessionCommand", {
  payload: {
    sessionId: SessionId,
    ttlSeconds: Schema.Number,
    thresholdSeconds: Schema.Number,
  },
  success: Schema.Void,
});
export type TouchSessionPayload = Command.Payload<typeof TouchSession>;
