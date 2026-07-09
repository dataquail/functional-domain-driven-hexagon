import { AuthContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { EnvVars } from "@/common/env-vars.js";
import { MintApiTokenCommand } from "@/modules/auth/commands/mint-api-token.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Mints a personal access token for the authenticated caller and returns the
// plaintext exactly once (only its hash is stored). `expiresInDays` falls
// back to the configured default when the payload omits it.
export const createTokenEndpoint = Effect.fn("AuthLive.tokens.create")(function* (
  request: EndpointRequest<typeof AuthContract.TokensGroup, "create">,
) {
  const currentUser = yield* CurrentUser;
  const env = yield* EnvVars;
  const commandBus = yield* CommandBus;
  const { apiToken, token } = yield* commandBus.execute(
    MintApiTokenCommand.make({
      userId: currentUser.userId,
      label: request.payload.label,
      expiresInDays: request.payload.expiresInDays ?? env.API_TOKEN_DEFAULT_TTL_DAYS,
    }),
  );
  return new AuthContract.CreateApiTokenResponse({
    id: apiToken.id,
    token,
    prefix: apiToken.prefix,
    expiresAt: apiToken.expiresAt,
  });
}, recoverPersistenceUnavailable);
