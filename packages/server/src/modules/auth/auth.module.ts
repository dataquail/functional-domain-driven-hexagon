import * as Layer from "effect/Layer";

import { RoleModule } from "@/modules/role/role.module.ts";
import { UserModule } from "@/modules/user/user.module.ts";

import { AuthCommandsLive } from "./auth.command-handlers.ts";
import { AuthQueriesLive } from "./auth.query-handlers.ts";
import { OidcClient } from "./infrastructure/clients/oidc.client.ts";
import { AuthIdentityRepositoryLive } from "./infrastructure/repositories/auth-identity.repository-live.ts";
import { SessionRepositoryLive } from "./infrastructure/repositories/session.repository-live.ts";
import { AuthLive } from "./interface/http/auth.endpoint-groups.ts";

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
