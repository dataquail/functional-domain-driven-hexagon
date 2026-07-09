export { authCommandHandlers } from "./auth.command-handlers.js";
export { AuthHttpDepsLive, AuthModuleLive } from "./auth.module.js";
export { authQueryHandlers } from "./auth.query-handlers.js";
// AuthSharedDepsLive narrowly exposes only CookieCodec for the
// platform middleware. The auth-module's handlers wrap their own
// SessionRepository internally (Stage B).
export { AuthSharedDepsLive } from "./auth.shared-deps.js";
export { MintApiTokenCommand } from "./commands/mint-api-token.command.js";
export { RevokeApiTokenCommand } from "./commands/revoke-api-token.command.js";
export { RevokeSessionCommand } from "./commands/revoke-session.command.js";
export { SignInCommand } from "./commands/sign-in.command.js";
// Dispatched by the auth middleware on the bearer path (ADR-0005).
export { TouchApiTokenCommand } from "./commands/touch-api-token.command.js";
export { TouchSessionCommand } from "./commands/touch-session.command.js";
export { ApiTokenExpired, ApiTokenNotFound, ApiTokenRevoked } from "./domain/api-token.errors.js";
export { ApiTokenId } from "./domain/api-token.id.js";
export { ApiTokenRoot } from "./domain/api-token.root.js";
// CredentialHash is shared with the auth middleware so the mint-time hash
// and the per-request bearer lookup agree.
export { CredentialHash } from "./domain/credential-hash.domain-service.js";
export {
  AuthIdentityNotFound,
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "./domain/session.errors.js";
export { SessionId } from "./domain/session.id.js";
export { SessionRoot } from "./domain/session.root.js";
export { FindApiTokenByHashQuery } from "./queries/find-api-token-by-hash.query.js";
export { FindSessionQuery } from "./queries/find-session.query.js";
export { ListMyApiTokensQuery } from "./queries/list-my-api-tokens.query.js";
