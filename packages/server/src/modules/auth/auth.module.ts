import * as Layer from "effect/Layer";

import { roleLayer } from "@/modules/role/role.exports.js";
import { userLayer } from "@/modules/user/user.exports.js";

import { AuthCommandsLive } from "./auth.command-handlers.js";
import { AuthQueriesLive } from "./auth.query-handlers.js";
import { OidcClient } from "./infrastructure/clients/oidc.client.js";
import { AuthIdentityRepositoryLive } from "./infrastructure/repositories/auth-identity.repository-live.js";
import { SessionRepositoryLive } from "./infrastructure/repositories/session.repository-live.js";
import { AuthLive } from "./interface/http/index.js";

export const AuthModule = {
  layer: Layer.mergeAll(AuthCommandsLive, AuthQueriesLive).pipe(
    Layer.provide(roleLayer),
    Layer.provide(userLayer),
  ),

  http: AuthLive.pipe(
    Layer.provide(AuthIdentityRepositoryLive),
    Layer.provide(SessionRepositoryLive),
  ),

  // The endpoints resolve this per request, so providing it onto the group
  // layer above leaves it in that layer's requirements: only the assembled api
  // layer, after `HttpRouter.serve` unwraps them, can satisfy it.
  httpDeps: OidcClient.layer,
};
