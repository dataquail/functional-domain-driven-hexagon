import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";

// Revoked rows stay for 7 days as an audit trail; expired-but-not-revoked rows
// have no audit value and go as soon as `expires_at < now()`. The DELETE is
// idempotent, so a duplicated cron run deletes nothing the first did not.
export type PurgeResult = {
  readonly rowsPurged: number;
};

export const purgeExpiredSessions: Effect.Effect<PurgeResult, never, Database.Database> =
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const deleted = yield* sql`
      DELETE FROM auth.sessions
      WHERE expires_at < now()
         OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')
      RETURNING id
    `.pipe(Effect.orDie);

    yield* Effect.logInfo(
      `[jobs.purge-expired-sessions] purged ${deleted.length} expired/aged-out session row(s)`,
    );

    return { rowsPurged: deleted.length };
  }).pipe(Effect.withSpan("jobs.purge-expired-sessions"));
