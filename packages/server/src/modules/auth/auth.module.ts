import * as Layer from "effect/Layer";

import { RoleLayer } from "@/modules/role/role.exports.js";
import { UserLayer } from "@/modules/user/user.exports.js";

import { AuthCommandsLive } from "./auth.command-handlers.js";
import { AuthQueriesLive } from "./auth.query-handlers.js";
import { OidcClient } from "./infrastructure/clients/oidc.client.js";
import { AuthIdentityRepositoryLive } from "./infrastructure/repositories/auth-identity.repository-live.js";
import { SessionRepositoryLive } from "./infrastructure/repositories/session.repository-live.js";
import { AuthLive } from "./interface/http/index.js";

export const AuthLayer = Layer.mergeAll(AuthCommandsLive, AuthQueriesLive).pipe(
  Layer.provide(RoleLayer),
  Layer.provide(UserLayer),
);

export const AuthHttpLayer = AuthLive.pipe(
  Layer.provide(AuthIdentityRepositoryLive),
  Layer.provide(SessionRepositoryLive),
);

// The endpoints consume this directly, so only the assembled api layer can
// satisfy it — `HttpRouter.provideRequest` on a group layer type-checks and
// then fails at runtime.
export const AuthHttpDepsLayer = OidcClient.layer;
