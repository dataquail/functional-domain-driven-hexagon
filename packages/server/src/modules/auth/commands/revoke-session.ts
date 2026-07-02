import * as Effect from "effect/Effect";

import {
  type RevokeSessionCommand,
  type RevokeSessionOutput,
} from "@/modules/auth/commands/revoke-session-command.js";
import { SessionRepository } from "@/modules/auth/domain/ports/repositories/session-repository.js";

// Logout must succeed even when the session row is missing, already
// revoked, or the DB is temporarily unavailable — the user's cookie
// will be cleared and the OIDC end-session URL will be hit either way,
// and an expired/missing local row is equivalent in observable
// behavior to a freshly-revoked one. Swallow both error variants.
export const revokeSession = (cmd: RevokeSessionCommand): RevokeSessionOutput =>
  Effect.gen(function* () {
    const repo = yield* SessionRepository;
    yield* repo.deleteOne(cmd.sessionId).pipe(
      Effect.catchTag("SessionNotFound", () => Effect.void),
      Effect.catchTag("SessionRevoked", () => Effect.void),
      Effect.catchTag("PersistenceUnavailable", () => Effect.void),
    );
  });
