import { type AuthContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { RevokeApiTokenCommand } from "@/modules/auth/commands/revoke-api-token.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Revokes one of the caller's own tokens. The command scopes the revoke to
// the owner, so a token that isn't the caller's (or doesn't exist) surfaces
// as `ApiTokenNotFound` → 404 without revealing whether it existed.
export const revokeTokenEndpoint = (
  request: EndpointRequest<typeof AuthContract.TokensGroup, "revoke">,
) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      RevokeApiTokenCommand.make({ apiTokenId: request.params.id, userId: currentUser.userId }),
    );
  }).pipe(
    Effect.catchTag("ApiTokenNotFound", () =>
      Effect.fail(new CustomHttpApiError.NotFound({ message: "API token not found" })),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("AuthLive.tokens.revoke"),
  );
