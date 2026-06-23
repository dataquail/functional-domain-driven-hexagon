import * as Effect from "effect/Effect";

import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token-repository.js";
import {
  type ListMyApiTokensOutput,
  type ListMyApiTokensQuery,
} from "@/modules/auth/queries/list-my-api-tokens-query.js";

// Bus-boundary span (ADR-0012) wraps this at dispatch time.
export const listMyApiTokens = (query: ListMyApiTokensQuery): ListMyApiTokensOutput =>
  Effect.gen(function* () {
    const repo = yield* ApiTokenRepository;
    return yield* repo.listByUser(query.userId);
  });
