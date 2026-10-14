// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is auth.exports.ts, and it is empty — nothing
// outside the platform depends on auth.
export { authCommandGroup, AuthCommands } from "./auth.command-handlers.ts";
export { AuthModule } from "./auth.module.ts";
export { AuthQueries, authQueryGroup } from "./auth.query-handlers.ts";

// Dispatched by the auth middleware on the bearer path (ADR-0005).
export { TouchApiTokenCommand } from "./commands/touch-api-token.command.ts";
export { TouchSessionCommand } from "./commands/touch-session.command.ts";

// CredentialHash is shared with the auth middleware so the mint-time hash
// and the per-request bearer lookup agree.
export { CredentialHash } from "./domain/domain-services/credential-hash.domain-service.ts";
export { SessionId } from "./domain/session/session.id.ts";
export { FindApiTokenByHashQuery } from "./queries/find-api-token-by-hash.query.ts";
export { FindSessionQuery } from "./queries/find-session.query.ts";
