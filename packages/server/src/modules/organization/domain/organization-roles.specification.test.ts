import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Result from "effect/Result";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRolesRootOps } from "./organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "./organization-roles.specification.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");

describe("OrganizationRolesSpecifications.hasRole", () => {
  it("returns false on an empty aggregate", () => {
    deepStrictEqual(
      OrganizationRolesSpecifications.hasRole(
        OrganizationRolesRootOps.empty(userId, orgId),
        "admin",
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
      OrganizationRolesSpecifications.hasRole(result.success.organizationRoles, "admin"),
      true,
    );
  });
});
