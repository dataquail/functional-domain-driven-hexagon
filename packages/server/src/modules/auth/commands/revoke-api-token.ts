import * as Effect from "effect/Effect";

import {
  type RevokeApiTokenCommand,
  type RevokeApiTokenOutput,
} from "@/modules/auth/commands/revoke-api-token-command.js";
import { ApiTokenNotFound } from "@/modules/auth/domain/api-token-errors.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token-repository.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Ownership-scoped revoke: load the token, refuse (as NotFound) if it isn't
// the caller's, then soft-delete. Returning NotFound for a foreign token
// avoids leaking the existence of other users' tokens.
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const revokeApiToken = (cmd: RevokeApiTokenCommand): RevokeApiTokenOutput =>
  Effect.gen(function* () {
    const repo = yield* ApiTokenRepository;
    const token = yield* repo.findOneById(cmd.apiTokenId);
    if (token.userId !== cmd.userId) {
      return yield* Effect.fail(new ApiTokenNotFound());
    }
    yield* repo.deleteOne(cmd.apiTokenId);
  }).pipe(withUnitOfWork);
