import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { AuthIdentityRepository } from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { AuthIdentitySpecifications } from "@/modules/auth/domain/auth-identity/auth-identity.specification.js";
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

  it.effect("findOne(bySubject) returns the seeded identity", () =>
    Effect.gen(function* () {
      yield* seedUserAndIdentity;
      const repo = yield* AuthIdentityRepository;
      const found = yield* repo.findOne(AuthIdentitySpecifications.bySubject(subject));
      if (found === null) throw new Error("expected an identity");
      deepStrictEqual(found.subject, subject);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.provider, "zitadel");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("insert links a subject to a user, retrievable via findOne(bySubject)", () =>
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

      const found = yield* repo.findOne(AuthIdentitySpecifications.bySubject("jit-sub"));
      if (found === null) throw new Error("expected an identity");
      deepStrictEqual(found.subject, "jit-sub");
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.provider, "zitadel");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("findOne returns null for an unknown subject (absence is not an error)", () =>
    Effect.gen(function* () {
      const repo = yield* AuthIdentityRepository;
      const found = yield* repo.findOne(AuthIdentitySpecifications.bySubject("missing-sub"));
      deepStrictEqual(found, null);
    }).pipe(Effect.provide(TestLayer)),
  );
});
