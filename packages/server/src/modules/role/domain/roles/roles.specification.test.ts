import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Result from "effect/Result";

import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { UserId } from "@/platform/ids/user-id.js";

import { type RolesRoot } from "./roles.root.js";
import { RolesRootOps } from "./roles.root-ops.js";
import { RolesSpecifications } from "./roles.specification.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

// Boundary (criteria-to-sql): `hasRole` reaches into the `roles` child
// collection, so it is a `Predicate`, not a translatable `Specification`, and
// must never be usable as a repository filter. This assignment must NOT
// compile — if `hasRole` ever gains a `.criteria`, the directive goes unused
// and the build fails, catching the regression.
// @ts-expect-error hasRole("super_admin") is a Predicate; it has no `.criteria`.
const _hasRoleIsNotASpecification: Specification<RolesRoot> =
  RolesSpecifications.hasRole("super_admin");
void _hasRoleIsNotASpecification;

describe("RolesSpecifications.hasRole", () => {
  it("returns false on an empty aggregate", () => {
    deepStrictEqual(RolesSpecifications.hasRole("super_admin")(RolesRootOps.empty(userId)), false);
  });

  it("returns true after the role is granted", () => {
    const result = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(RolesSpecifications.hasRole("super_admin")(result.success.roles), true);
  });
});
