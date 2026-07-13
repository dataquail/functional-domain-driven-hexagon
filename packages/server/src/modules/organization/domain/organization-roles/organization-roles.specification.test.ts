import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Result from "effect/Result";

import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { type OrganizationRolesRoot } from "./organization-roles.root.js";
import { OrganizationRolesRootOps } from "./organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "./organization-roles.specification.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");

// Boundary (criteria-to-sql): `hasRole` reaches into the `roles` child
// collection, so it is a `Predicate`, not a translatable `Specification`, and
// must never be usable as a repository filter. This assignment must NOT
// compile — if `hasRole` ever gains a `.criteria`, the directive goes unused
// and the build fails, catching the regression.
// @ts-expect-error hasRole("admin") is a Predicate; it has no `.criteria`.
const _hasRoleIsNotASpecification: Specification<OrganizationRolesRoot> =
  OrganizationRolesSpecifications.hasRole("admin");
void _hasRoleIsNotASpecification;

describe("OrganizationRolesSpecifications.hasRole", () => {
  it("returns false on an empty aggregate", () => {
    deepStrictEqual(
      OrganizationRolesSpecifications.hasRole("admin")(
        OrganizationRolesRootOps.empty(userId, orgId),
      ),
      false,
    );
  });

  it("returns true once the role is granted", () => {
    const result = OrganizationRolesRootOps.grantRole(
      OrganizationRolesRootOps.empty(userId, orgId),
      "admin",
      issuedBy,
    );
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(
      OrganizationRolesSpecifications.hasRole("admin")(result.success.organizationRoles),
      true,
    );
  });
});
