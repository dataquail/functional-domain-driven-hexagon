import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { PlatformRolesLive } from "@/modules/auth/infrastructure/acl/platform-roles.acl-live.js";
import { findCurrentUser } from "@/modules/auth/queries/find-current-user.handler.js";
import { RoleQueriesLive } from "@/modules/role/index.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const superAdminId = UserId.make("11111111-1111-1111-1111-111111111111");
const memberId = UserId.make("22222222-2222-2222-2222-222222222222");

// Stages the real cross-module chain rather than a stub: the auth query reads its
// `PlatformRoles` port, whose adapter dispatches the role module's query through that
// module's real dispatch surface into real SQL. This is the seam a stubbed unit test
// cannot cover — a rename or shape change on the role module's published policy-query
// fails here.
const TestLayer = PlatformRolesLive.pipe(
  Layer.provide(RoleQueriesLive),
  Layer.provideMerge(TestDatabaseLive),
);

const seedUsers = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES
          (${superAdminId}, 'admin@example.com', 'USA', '1 St', '12345', now(), now()),
          (${memberId}, 'member@example.com', 'USA', '2 St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const grantSuperAdmin = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO platform.roles (user_id, role, granted_at)
        VALUES (${superAdminId}, 'super_admin', now())
      `),
    )
    .pipe(Effect.orDie);
});

const suite = describe.sequential;

suite("findCurrentUser (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("platform.roles", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it("reports isSuperAdmin for a user holding the platform role", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedUsers;
        yield* grantSuperAdmin;
        const view = yield* findCurrentUser({ userId: superAdminId });
        deepStrictEqual(view, { userId: superAdminId, isSuperAdmin: true });
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  it("reports isSuperAdmin false for an ordinary user", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedUsers;
        yield* grantSuperAdmin;
        const view = yield* findCurrentUser({ userId: memberId });
        deepStrictEqual(view, { userId: memberId, isSuperAdmin: false });
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
