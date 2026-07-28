export { AuthCommands, AuthCommandsLive } from "./auth.command-handlers.js";
export { AuthHttpDepsLive, AuthModuleLive } from "./auth.module.js";
export { AuthQueries, AuthQueriesLive } from "./auth.query-handlers.js";
// AuthSharedDepsLive narrowly exposes only CookieCodec for the
// platform middleware. The auth-module's handlers wrap their own
// SessionRepository internally (Stage B).
export { AuthSharedDepsLive } from "./auth.shared-deps.js";
export { MintApiToken } from "./commands/mint-api-token.command.js";
export { RevokeApiToken } from "./commands/revoke-api-token.command.js";
export { RevokeSession } from "./commands/revoke-session.command.js";
export { SignIn } from "./commands/sign-in.command.js";
// Dispatched by the auth middleware on the bearer path (ADR-0005).
export { TouchApiToken } from "./commands/touch-api-token.command.js";
export { TouchSession } from "./commands/touch-session.command.js";
export {
  ApiTokenExpired,
  ApiTokenNotFound,
  ApiTokenRevoked,
} from "./domain/api-token/api-token.errors.js";
export { ApiTokenId } from "./domain/api-token/api-token.id.js";
export { ApiTokenRoot } from "./domain/api-token/api-token.root.js";
// CredentialHash is shared with the auth middleware so the mint-time hash
// and the per-request bearer lookup agree.
export { AuthIdentityNotFound } from "./domain/auth-identity/auth-identity.errors.js";
export { CredentialHash } from "./domain/domain-services/credential-hash.domain-service.js";
export {
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "./domain/session/session.errors.js";
export { SessionId } from "./domain/session/session.id.js";
export { SessionRoot } from "./domain/session/session.root.js";
export { FindApiTokenByHash } from "./queries/find-api-token-by-hash.query.js";
export { FindSession } from "./queries/find-session.query.js";
export { ListMyApiTokens } from "./queries/list-my-api-tokens.query.js";
