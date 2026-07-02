import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";

import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles-repository.js";
import { empty as emptyRoles, grant } from "@/modules/role/domain/roles.aggregate.js";
import { UserId } from "@/platform/ids/user-id.js";

import { RolesRepositoryFake } from "./roles-repository-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

describe("RolesRepositoryFake", () => {
  it.effect("returns an empty aggregate for a previously-unseen user", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      const roles = yield* repo.findOneByUserId(userId);
      deepStrictEqual(roles.userId, userId);
      deepStrictEqual([...roles.roles], []);
    }).pipe(Effect.provide(RolesRepositoryFake)),
  );

  it.effect("round-trips a saved aggregate via findOneByUserId", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      const granted = grant(emptyRoles(userId), "super_admin");
      if (Either.isLeft(granted)) throw new Error("expected Right");
      yield* repo.upsertOne(granted.right.roles);
      const fetched = yield* repo.findOneByUserId(userId);
      deepStrictEqual([...fetched.roles], ["super_admin"]);
    }).pipe(Effect.provide(RolesRepositoryFake)),
  );
});
