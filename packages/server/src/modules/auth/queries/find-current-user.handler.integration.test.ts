import { deepStrictEqual } from "node:assert";

import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { PlatformRolesLive } from "@/modules/auth/infrastructure/acl/platform-roles.acl-live.ts";
import { findCurrentUserHandler } from "@/modules/auth/queries/find-current-user.handler.ts";
import { RoleQueriesLive } from "@/modules/role/role.platform.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

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
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES
          (${superAdminId}, 'admin@example.com', 'USA', '1 St', '12345', now(), now()),
          (${memberId}, 'member@example.com', 'USA', '2 St', '12345', now(), now())
      `.pipe(Effect.orDie);
});

const grantSuperAdmin = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO platform.roles (user_id, role, granted_at)
        VALUES (${superAdminId}, 'super_admin', now())
      `.pipe(Effect.orDie);
});

describeIntegration(
  "findCurrentUserHandler (integration)",
  { layer: TestLayer, tables: ["platform.roles", "user.users"] },
  (it) => {
    it.effect("reports isSuperAdmin for a user holding the platform role", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        yield* grantSuperAdmin;
        const view = yield* findCurrentUserHandler({ userId: superAdminId });
        deepStrictEqual(view, { userId: superAdminId, isSuperAdmin: true });
      }),
    );

    it.effect("reports isSuperAdmin false for an ordinary user", () =>
      Effect.gen(function* () {
        yield* seedUsers;
        yield* grantSuperAdmin;
        const view = yield* findCurrentUserHandler({ userId: memberId });
        deepStrictEqual(view, { userId: memberId, isSuperAdmin: false });
      }),
    );
  },
);
