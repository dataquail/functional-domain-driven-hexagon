import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository";
import { RolesRootOps } from "@/modules/role/domain/roles/roles.root-ops";
import { RolesSpecifications } from "@/modules/role/domain/roles/roles.specification";

import { RolesRepositoryFake } from "./roles.repository-fake";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

const forUser = RolesSpecifications.forUser(userId);

describe("RolesRepositoryFake", () => {
  it.effect("findOne returns none for a previously-unseen user", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      assertNone(yield* repo.findOne(forUser));
    }).pipe(Effect.provide(RolesRepositoryFake)),
  );

  it.effect("round-trips a saved aggregate via findOne", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;

      const granted = Result.getOrThrow(
        RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"),
      );

      yield* repo.upsertOne(granted.roles);
      const fetched = yield* Effect.fromOption(yield* repo.findOne(forUser));
      deepStrictEqual([...fetched.roles], ["super_admin"]);
    }).pipe(Effect.provide(RolesRepositoryFake)),
  );
});
