import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { ApiTokenExpired, ApiTokenRevoked } from "@/modules/auth/domain/api-token.errors.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token.root.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { type FindApiTokenByHashQuery } from "@/modules/auth/queries/find-api-token-by-hash.query.js";

// Looks up a token by hash and validates its lifecycle (revoked / expired).
// Used by the auth middleware via `QueryBus.execute(...)`; the bus-boundary
// span (ADR-0012) wraps this at dispatch time.
export const findApiTokenByHash = Effect.fn("findApiTokenByHash")(function* (
  query: FindApiTokenByHashQuery,
) {
  const repo = yield* ApiTokenRepository;
  const token = yield* repo.findOneByHash(query.tokenHash);
  if (token.revokedAt !== null) {
    return yield* Effect.fail(new ApiTokenRevoked());
  }
  const now = yield* DateTime.now;
  if (ApiTokenRootOps.isExpired(token, now)) {
    return yield* Effect.fail(new ApiTokenExpired());
  }
  return token;
});
