import { withUnitOfWork } from "@effect-server-utils/cqrs";
import * as Effect from "effect/Effect";

import { type RevokeApiTokenPayload } from "@/modules/auth/commands/revoke-api-token.command.js";
import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { ApiTokenSpecifications } from "@/modules/auth/domain/api-token/api-token.specification.js";

// Ownership-scoped revoke: load the token, refuse (as NotFound) if it isn't
// the caller's, then soft-delete. Returning NotFound for a foreign token
// avoids leaking the existence of other users' tokens.
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const revokeApiTokenHandler = Effect.fn("revokeApiTokenHandler")(function* (
  cmd: RevokeApiTokenPayload,
) {
  const repo = yield* ApiTokenRepository;
  const token = yield* repo.findOne(ApiTokenSpecifications.withId(cmd.apiTokenId));
  if (token?.userId !== cmd.userId) {
    return yield* new ApiTokenNotFound();
  }
  yield* repo.deleteOne(cmd.apiTokenId);
}, withUnitOfWork);
