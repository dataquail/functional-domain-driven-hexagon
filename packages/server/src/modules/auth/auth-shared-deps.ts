import { CookieCodec } from "@/platform/auth/cookie-codec.js";

// CookieCodec is the one auth-infra service that crosses the module
// boundary by reference: the auth module signs the session cookie at
// login/callback, the platform middleware verifies it on every request,
// and they MUST share the same instance so the verify key matches the
// signing key.
//
// `SessionRepository` used to live here too, but Stage B handler
// wrapping means the auth-module's command/query handlers self-discharge
// it via `SessionRepositoryLive` — and Effect's Layer memoization
// ensures the wrap and any future consumer see the same instance.
export const AuthSharedDepsLive = CookieCodec.Default;
