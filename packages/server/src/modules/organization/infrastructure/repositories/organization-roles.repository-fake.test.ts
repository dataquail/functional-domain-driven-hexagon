import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRolesRepositoryFake } from "./organization-roles.repository-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");

const forPair = Spec.and(
  OrganizationRolesSpecifications.forUser(userId),
  OrganizationRolesSpecifications.forOrganization(orgId),
);

describe("OrganizationRolesRepositoryFake", () => {
  it.effect("findOne returns null for a previously-unseen (user, org) pair", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRolesRepository;
      const roles = yield* repo.findOne(forPair);
      deepStrictEqual(roles, null);
    }).pipe(Effect.provide(OrganizationRolesRepositoryFake)),
  );

  it.effect("round-trips a saved aggregate via findOne", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRolesRepository;
      const granted = OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(userId, orgId),
        "admin",
        issuedBy,
      );
      if (Result.isFailure(granted)) throw new Error("expected Right");
      yield* repo.upsertOne(granted.success.organizationRoles);
      const fetched = yield* repo.findOne(forPair);
      if (fetched === null) throw new Error("expected aggregate");
      deepStrictEqual(
        fetched.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
        [{ role: "admin", issuedBy }],
      );
    }).pipe(Effect.provide(OrganizationRolesRepositoryFake)),
  );
});
