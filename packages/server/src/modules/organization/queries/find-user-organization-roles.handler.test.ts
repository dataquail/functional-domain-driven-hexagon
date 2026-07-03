import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";

import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles.root.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-fake.js";
import { findUserOrganizationRoles } from "@/modules/organization/queries/find-user-organization-roles.handler.js";
import { FindUserOrganizationRolesQuery } from "@/modules/organization/queries/find-user-organization-roles.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");

describe("findUserOrganizationRoles", () => {
  it.effect("returns an empty roles array for a (user, org) with none granted", () =>
    Effect.gen(function* () {
      const result = yield* findUserOrganizationRoles(
        FindUserOrganizationRolesQuery.make({ userId, organizationId: orgId }),
      );
      deepStrictEqual(result.userId, userId);
      deepStrictEqual(result.organizationId, orgId);
      deepStrictEqual([...result.roles], []);
    }).pipe(Effect.provide(OrganizationRolesRepositoryFake)),
  );

  it.effect("returns the granted roles, projected to bare role names", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRolesRepository;
      const granted = OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(userId, orgId),
        "admin",
        issuedBy,
      );
      if (Either.isLeft(granted)) throw new Error("expected Right");
      yield* repo.upsertOne(granted.right.organizationRoles);
      const result = yield* findUserOrganizationRoles(
        FindUserOrganizationRolesQuery.make({ userId, organizationId: orgId }),
      );
      deepStrictEqual([...result.roles], ["admin"]);
    }).pipe(Effect.provide(OrganizationRolesRepositoryFake)),
  );
});
