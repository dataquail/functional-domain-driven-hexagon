import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Revokes one of the caller's own tokens. Carries `userId` so the handler
// can scope the revoke to the owner — a token belonging to someone else is
// reported as `ApiTokenNotFound`, never revealed.
export const RevokeApiTokenCommand = Command.make("RevokeApiTokenCommand", {
  payload: { apiTokenId: ApiTokenId, userId: UserId },
  success: Schema.Void,
  failure: Schema.Union([ApiTokenNotFound, PersistenceUnavailable]),
});
export type RevokeApiTokenPayload = Command.Payload<typeof RevokeApiTokenCommand>;
