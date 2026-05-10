import * as Layer from "effect/Layer";
import { AuthIdentityRepositoryLive } from "./infrastructure/auth-identity-repository-live.js";
import { OidcClient } from "./infrastructure/oidc-client.js";
import { AuthHttpLive } from "./interface/auth-http-live.js";

// AuthModuleLive registers the HTTP handlers and the auth-only
// infrastructure they depend on. The OIDC client is private to the
// callback path; AuthIdentityRepository is read only by sign-in and
// never crosses the module boundary — both stay internal here.
//
// CookieCodec and SessionRepository are the two auth-infra services
// that DO cross the boundary (the platform middleware needs the same
// instances). Those live in `AuthSharedDepsLive` (auth-shared-deps.ts)
// and are provided once at the API layer so both consumers share the
// same references.
export const AuthModuleLive = AuthHttpLive.pipe(
  Layer.provide(OidcClient.Default),
  Layer.provide(AuthIdentityRepositoryLive),
);
