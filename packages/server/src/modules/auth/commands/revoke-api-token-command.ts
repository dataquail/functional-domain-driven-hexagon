import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type ApiTokenNotFound } from "@/modules/auth/domain/api-token-errors.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token-id.js";
import { type ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
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

// Raw handler effect — `ApiTokenRepository` is discharged by the wrap in
// `auth-command-handlers.ts`; `UnitOfWork` is reintroduced by `withUnitOfWork`.
export type RevokeApiTokenOutput = Effect.Effect<
  void,
  ApiTokenNotFound | PersistenceUnavailable,
  ApiTokenRepository | UnitOfWork
>;
