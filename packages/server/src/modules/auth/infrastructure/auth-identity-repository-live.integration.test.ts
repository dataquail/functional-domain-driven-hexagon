import { AuthIdentityRepository } from "@/modules/auth/domain/auth-identity-repository.js";
import { AuthIdentityNotFound } from "@/modules/auth/domain/session-errors.js";
import { AuthIdentityRepositoryLive } from "@/modules/auth/infrastructure/auth-identity-repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const subject = "zitadel-sub-integration";

const TestLayer = AuthIdentityRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUserAndIdentity = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO users (id, email, role, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'admin@example.com', 'admin', 'N/A', 'N/A', 'N/A', now(), now())
    `),
  );
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO auth_identities (subject, user_id, provider, created_at)
      VALUES (${subject}, ${userId}, 'zitadel', now())
    `),
  );
}).pipe(Effect.orDie);

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("AuthIdentityRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("findBySubject returns the seeded identity", () =>
    Effect.gen(function* () {
      yield* seedUserAndIdentity;
      const repo = yield* AuthIdentityRepository;
      const found = yield* repo.findBySubject(subject);
      deepStrictEqual(found.subject, subject);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.provider, "zitadel");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("findBySubject fails AuthIdentityNotFound for an unknown subject", () =>
    Effect.gen(function* () {
      const repo = yield* AuthIdentityRepository;
      const exit = yield* Effect.exit(repo.findBySubject("missing-sub"));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof AuthIdentityNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
