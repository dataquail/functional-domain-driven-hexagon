import * as Layer from "effect/Layer";
import { OidcClient } from "./infrastructure/oidc-client.js";
import { AuthHttpLive } from "./interface/auth-http-live.js";

// AuthModuleLive only registers the HTTP handlers + the OIDC client (which is
// private to the callback path). The repository implementations and the
// CookieCodec live in `AuthSharedDepsLive` (auth-shared-deps.ts) so they can
// be consumed by both the auth module and the platform middleware without a
// duplicate provider — see plan §3.4 + the small depcruise exception.
export const AuthModuleLive = AuthHttpLive.pipe(Layer.provide(OidcClient.Default));
