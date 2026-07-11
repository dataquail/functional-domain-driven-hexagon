import * as Schema from "effect/Schema";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Revokes one of the caller's own tokens. Carries `userId` so the handler
// can scope the revoke to the owner — a token belonging to someone else is
// reported as `ApiTokenNotFound`, never revealed.
export const RevokeApiTokenCommand = Schema.TaggedStruct("RevokeApiTokenCommand", {
  apiTokenId: ApiTokenId,
  userId: UserId,
});
export type RevokeApiTokenCommand = typeof RevokeApiTokenCommand.Type;

export const revokeApiTokenCommandSpanAttributes: SpanAttributesExtractor<RevokeApiTokenCommand> = (
  c,
) => ({ "auth.api_token.id": c.apiTokenId, "user.id": c.userId });
