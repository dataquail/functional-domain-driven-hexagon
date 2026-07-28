import { type AuthContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { RevokeApiToken } from "@/modules/auth/commands/revoke-api-token.command.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Revokes one of the caller's own tokens. The command scopes the revoke to
// the owner, so a token that isn't the caller's (or doesn't exist) surfaces
// as `ApiTokenNotFound` → 404 without revealing whether it existed.
export const revokeTokenEndpoint = Effect.fn("AuthLive.tokens.revoke")(
  function* (request: EndpointRequest<typeof AuthContract.TokensGroup, "revoke">) {
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(RevokeApiToken, {
      apiTokenId: request.params.id,
      userId: currentUser.userId,
    });
  },
  Effect.catchTag("ApiTokenNotFound", () =>
    Effect.fail(new CustomHttpApiError.NotFound({ message: "API token not found" })),
  ),
  recoverPersistenceUnavailable,
);
