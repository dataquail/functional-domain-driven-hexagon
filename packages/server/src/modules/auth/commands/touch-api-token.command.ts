import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";

// Records last-used time for a token, dispatched by the auth middleware after a successful
// bearer lookup. Throttled + race-tolerant in the handler, so it's safe to fire on every
// request. Unlike sessions there is no sliding TTL — this only stamps `lastUsedAt`, and there
// is no failure channel because that stamp must never fail a request.
export const TouchApiToken = Command.make("TouchApiTokenCommand", {
  payload: { apiTokenId: ApiTokenId, thresholdSeconds: Schema.Number },
  success: Schema.Void,
});
export type TouchApiTokenPayload = Command.Payload<typeof TouchApiToken>;
