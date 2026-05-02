import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";
import { hasTestDatabase, TestDatabaseLive, truncate } from "../test-utils/test-database.js";
import { purgeExpiredSessions } from "./purge-expired-sessions.js";

const userId = "11111111-1111-1111-1111-111111111111";

const seedUser = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO users (id, email, role, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'admin@example.com', 'admin', 'N/A', 'N/A', 'N/A', now(), now())
    `),
  );
}).pipe(Effect.orDie);

type SessionShape = {
  readonly id: string;
  readonly expiresAtSql: string;
  readonly absoluteExpiresAtSql: string;
  readonly revokedAtSql: string | null;
};

const seedSession = (s: SessionShape) =>
  Effect.flatMap(Database.Database, (db) =>
    db.execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO sessions (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
        VALUES (
          ${s.id},
          ${userId},
          'zitadel-sub',
          ${sql.unsafe`${sql.literalValue(s.expiresAtSql)}::timestamptz`},
          ${sql.unsafe`${sql.literalValue(s.absoluteExpiresAtSql)}::timestamptz`},
          ${s.revokedAtSql === null ? sql.unsafe`NULL` : sql.unsafe`${sql.literalValue(s.revokedAtSql)}::timestamptz`},
          now(),
          now()
        )
      `),
    ),
  ).pipe(Effect.orDie);

const countSessions = Effect.flatMap(Database.Database, (db) =>
  db.execute((client) => client.oneFirst(sql.unsafe`SELECT count(*)::int FROM sessions`)),
).pipe(Effect.orDie) as Effect.Effect<number, never, Database.Database>;

const findSessionIds = Effect.flatMap(Database.Database, (db) =>
  db.execute((client) => client.anyFirst(sql.unsafe`SELECT id::text FROM sessions ORDER BY id`)),
).pipe(Effect.orDie) as Effect.Effect<ReadonlyArray<string>, never, Database.Database>;

const TestLayer = Layer.provideMerge(Layer.empty, TestDatabaseLive);

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("purgeExpiredSessions (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("sessions", "users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("deletes rows whose expires_at has passed and keeps still-valid rows", () =>
    Effect.gen(function* () {
      yield* seedUser;
      yield* seedSession({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        expiresAtSql: "1999-01-01T00:00:00Z",
        absoluteExpiresAtSql: "1999-01-02T00:00:00Z",
        revokedAtSql: null,
      });
      yield* seedSession({
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        expiresAtSql: "2099-01-01T00:00:00Z",
        absoluteExpiresAtSql: "2099-01-02T00:00:00Z",
        revokedAtSql: null,
      });

      const result = yield* purgeExpiredSessions;
      deepStrictEqual(result.skipped, false);
      deepStrictEqual(result.rowsPurged, 1);

      const remaining = yield* findSessionIds;
      deepStrictEqual(remaining, ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "deletes revoked rows past the 7-day grace, keeps recently-revoked, keeps unrevoked-and-fresh",
    () =>
      Effect.gen(function* () {
        yield* seedUser;
        // Revoked beyond the 7-day audit window — should be purged.
        yield* seedSession({
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          expiresAtSql: "2099-01-01T00:00:00Z",
          absoluteExpiresAtSql: "2099-01-02T00:00:00Z",
          revokedAtSql: "1999-01-01T00:00:00Z",
        });
        // Revoked recently (1 hour ago) — within grace, should remain.
        yield* Effect.flatMap(Database.Database, (db) =>
          db.execute((client) =>
            client.query(sql.unsafe`
              INSERT INTO sessions (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
              VALUES (
                'dddddddd-dddd-dddd-dddd-dddddddddddd',
                ${userId},
                'zitadel-sub',
                '2099-01-01T00:00:00Z'::timestamptz,
                '2099-01-02T00:00:00Z'::timestamptz,
                now() - interval '1 hour',
                now(),
                now()
              )
            `),
          ),
        ).pipe(Effect.orDie);
        // Unrevoked, far-future expiry — should remain.
        yield* seedSession({
          id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
          expiresAtSql: "2099-01-01T00:00:00Z",
          absoluteExpiresAtSql: "2099-01-02T00:00:00Z",
          revokedAtSql: null,
        });

        const result = yield* purgeExpiredSessions;
        deepStrictEqual(result.skipped, false);
        deepStrictEqual(result.rowsPurged, 1);

        const remaining = yield* findSessionIds;
        deepStrictEqual(remaining, [
          "dddddddd-dddd-dddd-dddd-dddddddddddd",
          "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        ]);
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("is a no-op when there are no sessions to purge", () =>
    Effect.gen(function* () {
      const result = yield* purgeExpiredSessions;
      deepStrictEqual(result.skipped, false);
      deepStrictEqual(result.rowsPurged, 0);
      const total = yield* countSessions;
      deepStrictEqual(total, 0);
    }).pipe(Effect.provide(TestLayer)),
  );
});
