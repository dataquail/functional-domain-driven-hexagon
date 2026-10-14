import { deepStrictEqual } from "node:assert";

import { layer } from "@effect/vitest";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { TestDatabaseLive, truncate } from "../test-utils/test-database.js";
import { purgeExpiredSessions } from "./purge-expired-sessions.js";

const userId = "11111111-1111-1111-1111-111111111111";

const CountRow = Schema.Struct({ value: Schema.Int });
const IdRow = Schema.Struct({ id: Schema.String });

const seedUser = Effect.flatMap(
  Database.Database,
  (sql) => sql`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'admin@example.com', 'N/A', 'N/A', 'N/A', now(), now())
  `,
).pipe(Effect.orDie);

type SeededSession = {
  readonly id: string;
  readonly expiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly revokedAt: Option.Option<string>;
};

const seedSession = (s: SeededSession) =>
  Effect.flatMap(
    Database.Database,
    (sql) => sql`
      INSERT INTO auth.sessions (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
      VALUES (
        ${s.id},
        ${userId},
        'identity-sub',
        ${s.expiresAt}::timestamptz,
        ${s.absoluteExpiresAt}::timestamptz,
        ${Option.getOrNull(s.revokedAt)}::timestamptz,
        now(),
        now()
      )
    `,
  ).pipe(Effect.orDie);

const countSessions = Effect.flatMap(Database.Database, (sql) =>
  sql`SELECT count(*)::int AS value FROM auth.sessions`.pipe(Database.row(CountRow)),
).pipe(
  Effect.map((row) => row.value),
  Effect.orDie,
);

const findSessionIds = Effect.flatMap(Database.Database, (sql) =>
  sql`SELECT id::text AS id FROM auth.sessions ORDER BY id`.pipe(Database.rows(IdRow)),
).pipe(
  Effect.map((rows) => rows.map((row) => row.id)),
  Effect.orDie,
);

const reset = truncate("auth.sessions", "user.users");

layer(TestDatabaseLive, { excludeTestServices: true })(
  "purgeExpiredSessions (integration)",
  (it) => {
    it.effect("deletes rows whose expires_at has passed and keeps still-valid rows", () =>
      Effect.gen(function* () {
        yield* reset;
        yield* seedUser;
        yield* seedSession({
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          expiresAt: "1999-01-01T00:00:00Z",
          absoluteExpiresAt: "1999-01-02T00:00:00Z",
          revokedAt: Option.none(),
        });
        yield* seedSession({
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          expiresAt: "2099-01-01T00:00:00Z",
          absoluteExpiresAt: "2099-01-02T00:00:00Z",
          revokedAt: Option.none(),
        });

        const result = yield* purgeExpiredSessions;
        deepStrictEqual(result.rowsPurged, 1);

        const remaining = yield* findSessionIds;
        deepStrictEqual(remaining, ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"]);
      }),
    );

    it.effect(
      "deletes revoked rows past the 7-day grace, keeps recently-revoked, keeps unrevoked-and-fresh",
      () =>
        Effect.gen(function* () {
          yield* reset;
          yield* seedUser;
          // Revoked beyond the 7-day audit window — should be purged.
          yield* seedSession({
            id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            expiresAt: "2099-01-01T00:00:00Z",
            absoluteExpiresAt: "2099-01-02T00:00:00Z",
            revokedAt: Option.some("1999-01-01T00:00:00Z"),
          });
          // Revoked recently (1 hour ago) — within grace, should remain.
          yield* Effect.flatMap(
            Database.Database,
            (sql) => sql`
              INSERT INTO auth.sessions (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
              VALUES (
                'dddddddd-dddd-dddd-dddd-dddddddddddd',
                ${userId},
                'identity-sub',
                '2099-01-01T00:00:00Z'::timestamptz,
                '2099-01-02T00:00:00Z'::timestamptz,
                now() - interval '1 hour',
                now(),
                now()
              )
            `,
          ).pipe(Effect.orDie);
          // Unrevoked, far-future expiry — should remain.
          yield* seedSession({
            id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
            expiresAt: "2099-01-01T00:00:00Z",
            absoluteExpiresAt: "2099-01-02T00:00:00Z",
            revokedAt: Option.none(),
          });

          const result = yield* purgeExpiredSessions;
          deepStrictEqual(result.rowsPurged, 1);

          const remaining = yield* findSessionIds;
          deepStrictEqual(remaining, [
            "dddddddd-dddd-dddd-dddd-dddddddddddd",
            "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
          ]);
        }),
    );

    it.effect("purges nothing more when the job runs twice", () =>
      Effect.gen(function* () {
        yield* reset;
        yield* seedUser;
        yield* seedSession({
          id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
          expiresAt: "1999-01-01T00:00:00Z",
          absoluteExpiresAt: "1999-01-02T00:00:00Z",
          revokedAt: Option.none(),
        });

        const first = yield* purgeExpiredSessions;
        const second = yield* purgeExpiredSessions;

        deepStrictEqual([first.rowsPurged, second.rowsPurged], [1, 0]);
      }),
    );

    it.effect("is a no-op when there are no sessions to purge", () =>
      Effect.gen(function* () {
        yield* reset;
        const result = yield* purgeExpiredSessions;
        deepStrictEqual(result.rowsPurged, 0);
        const total = yield* countSessions;
        deepStrictEqual(total, 0);
      }),
    );
  },
);
