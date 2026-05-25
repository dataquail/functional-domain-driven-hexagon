import * as Layer from "effect/Layer";

import { AuthIdentityRepositoryLive } from "./infrastructure/auth-identity-repository-live.js";
import { OidcClient } from "./infrastructure/oidc-client.js";
import { SessionRepositoryLive } from "./infrastructure/session-repository-live.js";
import { AuthLive } from "./interface/http/auth-live.js";

// AuthModuleLive registers the HTTP handlers and the auth-only
// infrastructure they depend on. The OIDC client is private to the
// callback path; AuthIdentityRepository is read only by sign-in;
// SessionRepository is used by the logout endpoint directly (no bus
// dispatch) — all stay internal here.
//
// CookieCodec is the only auth-infra service still hoisted via
// `AuthSharedDepsLive` because the platform middleware verifies the
// session cookie with the same key the auth module signs with.
export const AuthModuleLive = AuthLive.pipe(
  Layer.provide(OidcClient.Default),
  Layer.provide(AuthIdentityRepositoryLive),
  Layer.provide(SessionRepositoryLive),
);
