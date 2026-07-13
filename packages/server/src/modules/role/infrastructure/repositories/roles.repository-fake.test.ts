import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.js";
import { RolesRootOps } from "@/modules/role/domain/roles/roles.root-ops.js";
import { RolesSpecifications } from "@/modules/role/domain/roles/roles.specification.js";
import { UserId } from "@/platform/ids/user-id.js";

import { RolesRepositoryFake } from "./roles.repository-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

const forUser = RolesSpecifications.forUser(userId);

describe("RolesRepositoryFake", () => {
  it.effect("findOne returns null for a previously-unseen user", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      const roles = yield* repo.findOne(forUser);
      deepStrictEqual(roles, null);
    }).pipe(Effect.provide(RolesRepositoryFake)),
  );

  it.effect("round-trips a saved aggregate via findOne", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      const granted = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
      if (Result.isFailure(granted)) throw new Error("expected Right");
      yield* repo.upsertOne(granted.success.roles);
      const fetched = yield* repo.findOne(forUser);
      if (fetched === null) throw new Error("expected aggregate");
      deepStrictEqual([...fetched.roles], ["super_admin"]);
    }).pipe(Effect.provide(RolesRepositoryFake)),
  );
});
