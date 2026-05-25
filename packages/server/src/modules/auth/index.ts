export { authCommandHandlers } from "./auth-command-handlers.js";
export { AuthModuleLive } from "./auth-module.js";
export { authQueryHandlers } from "./auth-query-handlers.js";
// AuthSharedDepsLive now narrowly exposes only CookieCodec for the
// platform middleware (Stage B wraps SessionRepository inside the
// auth-module's handlers). See auth-shared-deps.ts.
export { AuthSharedDepsLive } from "./auth-shared-deps.js";
export { SignInCommand } from "./commands/sign-in-command.js";
export { TouchSessionCommand } from "./commands/touch-session-command.js";
export { Session } from "./domain/session.aggregate.js";
export {
  AuthIdentityNotFound,
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "./domain/session-errors.js";
export { SessionId } from "./domain/session-id.js";
export { SessionRepository } from "./domain/session-repository.js";
export { FindSessionQuery } from "./queries/find-session-query.js";
