import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Result from "effect/Result";

import { UserId } from "@/platform/ids/user-id.js";

import { RolesRootOps } from "./roles.root-ops.js";
import { RolesSpecifications } from "./roles.specification.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

describe("RolesSpecifications.hasRole", () => {
  it("returns false on an empty aggregate", () => {
    deepStrictEqual(RolesSpecifications.hasRole(RolesRootOps.empty(userId), "super_admin"), false);
  });

  it("returns true after the role is granted", () => {
    const result = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(RolesSpecifications.hasRole(result.success.roles, "super_admin"), true);
  });
});
