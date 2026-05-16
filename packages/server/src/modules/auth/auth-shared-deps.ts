import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import * as Layer from "effect/Layer";
import { SessionRepositoryLive } from "./infrastructure/session-repository-live.js";

// The two auth-infra services that genuinely cross the module
// boundary:
//
//   - CookieCodec — the auth module signs the session cookie at
//     login/callback; the platform middleware verifies it on every
//     request. They MUST share the same instance so the verify key
//     matches the signing key.
//   - SessionRepository — the auth module writes sessions at sign-in;
//     the middleware reads them on every request via FindSessionQuery
//     (whose handler also depends on SessionRepository). Same instance
//     keeps the read and write paths consistent.
//
// Provided once at the API layer (server.ts / test-server.ts) so the
// auth module's handlers AND the platform middleware see the same
// service instances. AuthIdentityRepository is intentionally NOT in
// this layer — it's a purely module-internal concern (only sign-in
// reads it) and is provided inside AuthModuleLive.
export const AuthSharedDepsLive = Layer.mergeAll(CookieCodec.Default, SessionRepositoryLive);
