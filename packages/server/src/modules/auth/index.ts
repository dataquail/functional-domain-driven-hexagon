// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is auth.exports.ts, and it is empty — nothing
// outside the platform depends on auth.
export { authCommandGroup, AuthCommands } from "./auth.command-handlers.js";
export { AuthHttpDepsLayer, AuthHttpLayer, AuthLayer } from "./auth.module.js";
export { AuthQueries, authQueryGroup } from "./auth.query-handlers.js";
// AuthSharedDepsLive narrowly exposes only CookieCodec for the
// platform middleware. The auth-module's handlers wrap their own
// SessionRepository internally (Stage B).
export { AuthSharedDepsLive } from "./auth.shared-deps.js";
// Dispatched by the auth middleware on the bearer path (ADR-0005).
export { TouchApiTokenCommand } from "./commands/touch-api-token.command.js";
export { TouchSessionCommand } from "./commands/touch-session.command.js";
// CredentialHash is shared with the auth middleware so the mint-time hash
// and the per-request bearer lookup agree.
export { CredentialHash } from "./domain/domain-services/credential-hash.domain-service.js";
export { SessionId } from "./domain/session/session.id.js";
export { FindApiTokenByHashQuery } from "./queries/find-api-token-by-hash.query.js";
export { FindSessionQuery } from "./queries/find-session.query.js";
