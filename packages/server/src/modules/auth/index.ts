export { authCommandHandlers } from "./commands/auth-command-handlers.js";
export { SignInCommand } from "./commands/sign-in-command.js";
export { TouchSessionCommand } from "./commands/touch-session-command.js";
export { authQueryHandlers } from "./queries/auth-query-handlers.js";
export { FindSessionQuery } from "./queries/find-session-query.js";

export { AuthModuleLive } from "./auth-module.js";
// AuthSharedDepsLive narrowly exposes the auth-infra services that
// must be shared by reference with the platform middleware
// (CookieCodec + SessionRepository). Other auth-infra services stay
// internal to AuthModuleLive — see auth-shared-deps.ts.
export { AuthSharedDepsLive } from "./auth-shared-deps.js";
export {
  AuthIdentityNotFound,
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "./domain/session-errors.js";
export { SessionId } from "./domain/session-id.js";
export { SessionRepository } from "./domain/session-repository.js";
export { Session } from "./domain/session.aggregate.js";
