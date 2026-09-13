import * as Layer from "effect/Layer";

import { RoleModule } from "@/modules/role/role.module.js";
import { UserModule } from "@/modules/user/user.module.js";

import { AuthCommandsLive } from "./auth.command-handlers.js";
import { AuthQueriesLive } from "./auth.query-handlers.js";
import { OidcClient } from "./infrastructure/clients/oidc.client.js";
import { AuthIdentityRepositoryLive } from "./infrastructure/repositories/auth-identity.repository-live.js";
import { SessionRepositoryLive } from "./infrastructure/repositories/session.repository-live.js";
import { AuthLive } from "./interface/http/index.js";

export const AuthModule = {
  layer: Layer.mergeAll(AuthCommandsLive, AuthQueriesLive).pipe(
    Layer.provide(RoleModule.layer),
    Layer.provide(UserModule.layer),
  ),

  http: AuthLive.pipe(
    Layer.provide(AuthIdentityRepositoryLive),
    Layer.provide(SessionRepositoryLive),
  ),

  // A handler's own requirement rides the group layer as `Request<"Requires",
  // OidcClient>`, which `Layer.provide(OidcClient.layer)` does not match and
  // `HttpRouter.provideRequest` matches only in the type: the group's routes are
  // built before the router sees them, so its middleware never reaches them and
  // the endpoint dies on this service. Only the assembled api layer, after
  // `serve` unwraps the marker, can satisfy it.
  httpDeps: OidcClient.layer,
};
