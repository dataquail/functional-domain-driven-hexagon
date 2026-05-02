import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

// Stable lock key for the purge job. `pg_try_advisory_xact_lock(bigint)`
// namespaces runs without coordinating across replicas: only the holder of
// this key runs the DELETE; everyone else short-circuits. The lock is
// transaction-scoped, so it auto-releases when the transaction commits or
// rolls back — no try/finally, no risk of a leaked lock.
//
// Picked once and never changed — different jobs MUST use distinct keys.
// Generated via:
//   node -e "console.log(BigInt('0x' + require('crypto').randomBytes(8).toString('hex')) & ((1n << 63n) - 1n))"
const PURGE_EXPIRED_SESSIONS_LOCK_KEY = 6438907123819245189n;

// Grace period applied to revoked rows. After a session is revoked we keep
// the row for 7 days as an audit trail ("did this user actually sign out
// before X happened?"), then physically delete. Expired-but-not-revoked rows
// have no audit value and are deleted as soon as `expires_at < now()`.
// Inlined into the SQL below as a literal Postgres interval — not a
// parameter — because `interval $1` is not valid syntax.

export type PurgeResult = {
  readonly rowsPurged: number;
  readonly skipped: boolean;
};

const LockRow = Schema.standardSchemaV1(Schema.Struct({ acquired: Schema.Boolean }));

export const purgeExpiredSessions: Effect.Effect<PurgeResult, never, Database.Database> =
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const result = yield* db
      .execute((client) =>
        client.transaction(async (tx) => {
          const lockRow = await tx.one(sql.type(LockRow)`
            SELECT pg_try_advisory_xact_lock(${PURGE_EXPIRED_SESSIONS_LOCK_KEY}) AS acquired
          `);
          if (!lockRow.acquired) {
            return { rowsPurged: 0, skipped: true } satisfies PurgeResult;
          }
          const deleted = await tx.query(sql.unsafe`
            DELETE FROM sessions
            WHERE expires_at < now()
               OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')
          `);
          return { rowsPurged: deleted.rowCount, skipped: false } satisfies PurgeResult;
        }),
      )
      .pipe(Effect.orDie);
    if (result.skipped) {
      yield* Effect.logInfo(
        "[jobs.purge-expired-sessions] another instance holds the advisory lock; skipping this run",
      );
    } else {
      yield* Effect.logInfo(
        `[jobs.purge-expired-sessions] purged ${result.rowsPurged} expired/aged-out session row(s)`,
      );
    }
    return result;
  }).pipe(Effect.withSpan("jobs.purge-expired-sessions"));
