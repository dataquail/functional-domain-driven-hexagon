import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Result from "effect/Result";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";

import { type RolesRoot } from "./roles.root.ts";
import { RolesRootOps } from "./roles.root-ops.ts";
import { RolesSpecifications } from "./roles.specification.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

// Boundary (criteria-to-sql): `hasRole` reaches into the `roles` child
// collection, so it is a `Predicate`, not a translatable `Specification`, and
// must never be usable as a repository filter. This assignment must NOT
// compile — if `hasRole` ever gains a `.criteria`, the directive goes unused
// and the build fails, catching the regression.
// @ts-expect-error -- hasRole("super_admin") is a Predicate; it has no `.criteria`.
const _hasRoleIsNotASpecification: Specification<RolesRoot> =
  RolesSpecifications.hasRole("super_admin");

void _hasRoleIsNotASpecification;

describe("RolesSpecifications.hasRole", () => {
  it("returns false on an empty aggregate", () => {
    deepStrictEqual(RolesSpecifications.hasRole("super_admin")(RolesRootOps.empty(userId)), false);
  });

  it("returns true after the role is granted", () => {
    const result = Result.getOrThrow(RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"));
    deepStrictEqual(RolesSpecifications.hasRole("super_admin")(result.roles), true);
  });
});
