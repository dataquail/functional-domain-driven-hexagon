import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { PlatformRoles } from "@/modules/organization/domain/ports/acl/platform-roles.acl.js";
import { PlatformRolesLive } from "@/modules/organization/infrastructure/acl/platform-roles.acl-live.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { UserId } from "@/platform/ids/user-id.js";

// Two consumers in this module: the policies' super-admin bypass, and the
// use-case invariant that a super-admin neither owns nor joins an organization.
// Both only need the boolean, so the role vocabulary stops here.
const userId = UserId.make("11111111-1111-1111-1111-111111111111");

const stubQueryBus = (roles: ReadonlyArray<string>) =>
  Layer.succeed(
    QueryBus,
    QueryBus.of({
      execute: ((query: { _tag: string; userId: UserId }) =>
        query._tag === "FindUserRolesQuery"
          ? Effect.succeed({ userId: query.userId, roles })
          : Effect.die(`unexpected query ${query._tag}`)) as never,
    }),
  );

const stubDatabase = Layer.succeed(Database.Database, {} as Database.Database["Service"]);

const testLayer = (roles: ReadonlyArray<string>) =>
  PlatformRolesLive.pipe(Layer.provide(stubQueryBus(roles)), Layer.provide(stubDatabase));

describe("PlatformRolesLive (organization)", () => {
  it.effect("reports true when the role module lists super_admin", () =>
    Effect.gen(function* () {
      const roles = yield* PlatformRoles;
      deepStrictEqual(yield* roles.isSuperAdmin(userId), true);
    }).pipe(Effect.provide(testLayer(["super_admin"]))),
  );

  it.effect("reports false when the caller holds no platform roles", () =>
    Effect.gen(function* () {
      const roles = yield* PlatformRoles;
      deepStrictEqual(yield* roles.isSuperAdmin(userId), false);
    }).pipe(Effect.provide(testLayer([]))),
  );

  it.effect("reports false for a platform role that is not super_admin", () =>
    Effect.gen(function* () {
      const roles = yield* PlatformRoles;
      deepStrictEqual(yield* roles.isSuperAdmin(userId), false);
    }).pipe(Effect.provide(testLayer(["some_other_role"]))),
  );
});
