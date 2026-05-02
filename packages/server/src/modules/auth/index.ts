export { authCommandHandlers } from "./commands/auth-command-handlers.js";
export { SignInCommand } from "./commands/sign-in-command.js";
export { TouchSessionCommand } from "./commands/touch-session-command.js";
export { authQueryHandlers } from "./queries/auth-query-handlers.js";
export { FindSessionQuery } from "./queries/find-session-query.js";

export { AuthModuleLive } from "./auth-module.js";
export { AuthSharedDepsLive } from "./auth-shared-deps.js";
export { AuthIdentityRepository } from "./domain/auth-identity-repository.js";
export {
  AuthIdentityNotFound,
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "./domain/session-errors.js";
export { SessionId } from "./domain/session-id.js";
export { SessionRepository } from "./domain/session-repository.js";
export { Session } from "./domain/session.aggregate.js";
