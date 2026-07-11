import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

import { AuthIdentityNotFound } from "@/modules/auth/domain/auth-identity/auth-identity.errors.js";
import { AuthIdentityRepository } from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { AuthIdentityRepositoryLive } from "@/modules/auth/infrastructure/repositories/auth-identity.repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const subject = "zitadel-sub-integration";

const TestLayer = AuthIdentityRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUserAndIdentity = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'admin@example.com', 'N/A', 'N/A', 'N/A', now(), now())
    `),
  );
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO auth.auth_identities (subject, user_id, provider, created_at)
      VALUES (${subject}, ${userId}, 'zitadel', now())
    `),
  );
}).pipe(Effect.orDie);

const suite = describe.sequential;

suite("AuthIdentityRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("user.users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("findOneBySubject returns the seeded identity", () =>
    Effect.gen(function* () {
      yield* seedUserAndIdentity;
      const repo = yield* AuthIdentityRepository;
      const found = yield* repo.findOneBySubject(subject);
      deepStrictEqual(found.subject, subject);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.provider, "zitadel");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("insert links a subject to a user, retrievable via findOneBySubject", () =>
    Effect.gen(function* () {
      // Seed only the user row (the FK target); the identity is created via
      // the repository's write path, mirroring JIT provisioning.
      const db = yield* Database.Database;
      yield* db
        .execute((client) =>
          client.query(sql.unsafe`
            INSERT INTO "user".users (id, email, created_at, updated_at)
            VALUES (${userId}, 'jit@example.com', now(), now())
          `),
        )
        .pipe(Effect.orDie);

      const repo = yield* AuthIdentityRepository;
      yield* repo.insertOne({ subject: "jit-sub", userId, provider: "zitadel" });

      const found = yield* repo.findOneBySubject("jit-sub");
      deepStrictEqual(found.subject, "jit-sub");
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.provider, "zitadel");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("findOneBySubject fails AuthIdentityNotFound for an unknown subject", () =>
    Effect.gen(function* () {
      const repo = yield* AuthIdentityRepository;
      const exit = yield* Effect.exit(repo.findOneBySubject("missing-sub"));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof AuthIdentityNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
