import * as Effect from "effect/Effect";

import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { type ListMyApiTokensQuery } from "@/modules/auth/queries/list-my-api-tokens.query.js";

// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const listMyApiTokens = Effect.fn("listMyApiTokens")(function* (
  query: ListMyApiTokensQuery,
) {
  const repo = yield* ApiTokenRepository;
  return yield* repo.findManyByUser(query.userId);
});
