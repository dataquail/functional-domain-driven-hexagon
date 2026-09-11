import { Module } from "@org/module";
import * as Layer from "effect/Layer";

import { AuthCommandsLive } from "./auth.command-handlers.js";
import { authExports } from "./auth.exports.js";
import { AuthQueriesLive } from "./auth.query-handlers.js";
import { OidcClient } from "./infrastructure/clients/oidc.client.js";
import { AuthIdentityRepositoryLive } from "./infrastructure/repositories/auth-identity.repository-live.js";
import { SessionRepositoryLive } from "./infrastructure/repositories/session.repository-live.js";
import { AuthLive } from "./interface/http/index.js";

// The auth-only infrastructure stays inside: the OIDC client is private to the
// callback path, AuthIdentityRepository is read only by sign-in, and
// SessionRepository is used by the logout endpoint directly. CookieCodec is the
// one piece hoisted (via `AuthSharedDepsLive`), because the platform middleware
// verifies the session cookie with the same key this module signs with.
//
// `OidcClient` is a `httpDeps` rather than part of `http`: the login, callback
// and logout endpoints consume it directly, so `HttpApiBuilder` tracks it as a
// request-scoped requirement, and only the assembled api layer can satisfy one
// — `HttpRouter.provideRequest` on a group layer type-checks and then fails at
// runtime.
export const AuthModule = Module.make("auth", Layer.mergeAll(AuthCommandsLive, AuthQueriesLive), {
  exports: authExports,
  http: AuthLive.pipe(
    Layer.provide(AuthIdentityRepositoryLive),
    Layer.provide(SessionRepositoryLive),
  ),
  httpDeps: OidcClient.layer,
});
