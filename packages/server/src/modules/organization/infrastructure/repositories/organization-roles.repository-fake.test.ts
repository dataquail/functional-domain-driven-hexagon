import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles.root.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRolesRepositoryFake } from "./organization-roles.repository-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");

describe("OrganizationRolesRepositoryFake", () => {
  it.effect("returns an empty aggregate for a previously-unseen (user, org) pair", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRolesRepository;
      const roles = yield* repo.findOneByUserIdAndOrgId(userId, orgId);
      deepStrictEqual(roles.userId, userId);
      deepStrictEqual(roles.organizationId, orgId);
      deepStrictEqual([...roles.roles], []);
    }).pipe(Effect.provide(OrganizationRolesRepositoryFake)),
  );

  it.effect("round-trips a saved aggregate via findOneByUserIdAndOrgId", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRolesRepository;
      const granted = OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(userId, orgId),
        "admin",
        issuedBy,
      );
      if (Result.isFailure(granted)) throw new Error("expected Right");
      yield* repo.upsertOne(granted.right.organizationRoles);
      const fetched = yield* repo.findOneByUserIdAndOrgId(userId, orgId);
      deepStrictEqual(
        fetched.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
        [{ role: "admin", issuedBy }],
      );
    }).pipe(Effect.provide(OrganizationRolesRepositoryFake)),
  );
});
