import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Revokes one of the caller's own tokens. Carries `userId` so the handler
// can scope the revoke to the owner — a token belonging to someone else is
// reported as `ApiTokenNotFound`, never revealed.
export const RevokeApiToken = Command.make("RevokeApiTokenCommand", {
  payload: { apiTokenId: ApiTokenId, userId: UserId },
  success: Schema.Void,
  failure: Schema.Union([ApiTokenNotFound, PersistenceUnavailable]),
});
export type RevokeApiTokenPayload = Command.Payload<typeof RevokeApiToken>;
