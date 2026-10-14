import { deepStrictEqual } from "node:assert";

import { assertNone } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { AuthIdentityRepository } from "@/modules/auth/domain/auth-identity/auth-identity.repository.ts";
import { AuthIdentitySpecifications } from "@/modules/auth/domain/auth-identity/auth-identity.specification.ts";
import { AuthIdentityRepositoryLive } from "@/modules/auth/infrastructure/repositories/auth-identity.repository-live.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const subject = "identity-sub-integration";

const TestLayer = AuthIdentityRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUserAndIdentity = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'admin@example.com', 'N/A', 'N/A', 'N/A', now(), now())
    `;
  yield* sql`
      INSERT INTO auth.auth_identities (subject, user_id, provider, created_at)
      VALUES (${subject}, ${userId}, 'better-auth', now())
    `;
}).pipe(Effect.orDie);

describeIntegration(
  "AuthIdentityRepositoryLive (integration)",
  { layer: TestLayer, tables: ["user.users"] },
  (it) => {
    it.effect("findOne(bySubject) returns the seeded identity", () =>
      Effect.gen(function* () {
        yield* seedUserAndIdentity;
        const repo = yield* AuthIdentityRepository;

        const found = yield* repo
          .findOne(AuthIdentitySpecifications.bySubject(subject))
          .pipe(Effect.flatMap(Effect.fromOption));

        deepStrictEqual(found.subject, subject);
        deepStrictEqual(found.userId, userId);
        deepStrictEqual(found.provider, "better-auth");
      }),
    );

    it.effect("insert links a subject to a user, retrievable via findOne(bySubject)", () =>
      Effect.gen(function* () {
        // Seed only the user row (the FK target); the identity is created via
        // the repository's write path, mirroring JIT provisioning.
        const sql = yield* Database.Database;
        yield* sql`
            INSERT INTO "user".users (id, email, created_at, updated_at)
            VALUES (${userId}, 'jit@example.com', now(), now())
          `.pipe(Effect.orDie);

        const repo = yield* AuthIdentityRepository;
        yield* repo.insertOne({ subject: "jit-sub", userId, provider: "better-auth" });

        const found = yield* repo
          .findOne(AuthIdentitySpecifications.bySubject("jit-sub"))
          .pipe(Effect.flatMap(Effect.fromOption));

        deepStrictEqual(found.subject, "jit-sub");
        deepStrictEqual(found.userId, userId);
        deepStrictEqual(found.provider, "better-auth");
      }),
    );

    it.effect("findOne returns null for an unknown subject (absence is not an error)", () =>
      Effect.gen(function* () {
        const repo = yield* AuthIdentityRepository;
        const found = yield* repo.findOne(AuthIdentitySpecifications.bySubject("missing-sub"));
        assertNone(found);
      }),
    );
  },
);
