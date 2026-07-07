import { AuthContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { ListMyApiTokensQuery } from "@/modules/auth/queries/list-my-api-tokens.query.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Lists the caller's active (non-revoked) tokens. Secret-free: only the
// display `prefix` and metadata are returned.
export const listTokensEndpoint = (
  _request: EndpointRequest<typeof AuthContract.TokensGroup, "list">,
) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentUser;
    const queryBus = yield* QueryBus;
    const tokens = yield* queryBus.execute(
      ListMyApiTokensQuery.make({ userId: currentUser.userId }),
    );
    return tokens.map(
      (t) =>
        new AuthContract.ApiTokenSummary({
          id: t.id,
          label: t.label,
          prefix: t.prefix,
          expiresAt: t.expiresAt,
          createdAt: t.createdAt,
          lastUsedAt: t.lastUsedAt,
        }),
    );
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("AuthLive.tokens.list"));
