import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";

import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles.repository.js";
import { RolesRootOps } from "@/modules/role/domain/roles.root.js";
import { RolesRepositoryFake } from "@/modules/role/infrastructure/repositories/roles.repository-fake.js";
import { findUserRoles } from "@/modules/role/queries/find-user-roles.handler.js";
import { FindUserRolesQuery } from "@/modules/role/queries/find-user-roles.query.js";
import { UserId } from "@/platform/ids/user-id.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

describe("findUserRoles", () => {
  it.effect("returns an empty role array for a user with none granted", () =>
    Effect.gen(function* () {
      const result = yield* findUserRoles(FindUserRolesQuery.make({ userId }));
      deepStrictEqual(result.userId, userId);
      deepStrictEqual([...result.roles], []);
    }).pipe(Effect.provide(RolesRepositoryFake)),
  );

  it.effect("returns the granted roles", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      const granted = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
      if (Either.isLeft(granted)) throw new Error("expected Right");
      yield* repo.upsertOne(granted.right.roles);
      const result = yield* findUserRoles(FindUserRolesQuery.make({ userId }));
      deepStrictEqual([...result.roles], ["super_admin"]);
    }).pipe(Effect.provide(RolesRepositoryFake)),
  );
});
