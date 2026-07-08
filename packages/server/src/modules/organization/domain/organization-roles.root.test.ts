import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Result from "effect/Result";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import {
  AlreadyHasOrganizationRole,
  DoesNotHaveOrganizationRole,
} from "./organization-role.errors.js";
import { type OrganizationRoleEvent } from "./organization-role.events.js";
import { OrganizationRolesRootOps } from "./organization-roles.root.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.make("99999999-9999-9999-9999-999999999999");

const expectEvent = <T extends OrganizationRoleEvent["_tag"]>(
  events: ReadonlyArray<OrganizationRoleEvent>,
  tag: T,
): Extract<OrganizationRoleEvent, { _tag: T }> => {
  const event = events[0];
  if (event?._tag !== tag) {
    throw new Error(`expected ${tag}, got ${String(event?._tag)}`);
  }
  return event as Extract<OrganizationRoleEvent, { _tag: T }>;
};

describe("OrganizationRolesRootOps.empty", () => {
  it("constructs an aggregate with no roles", () => {
    const aggregate = OrganizationRolesRootOps.empty(userId, orgId);
    deepStrictEqual(aggregate.userId, userId);
    deepStrictEqual(aggregate.organizationId, orgId);
    deepStrictEqual([...aggregate.roles], []);
  });
});

describe("OrganizationRolesRootOps.hasRole", () => {
  it("returns false on an empty aggregate", () => {
    deepStrictEqual(
      OrganizationRolesRootOps.hasRole(OrganizationRolesRootOps.empty(userId, orgId), "admin"),
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
      OrganizationRolesRootOps.hasRole(result.success.organizationRoles, "admin"),
      true,
    );
  });
});

describe("OrganizationRolesRootOps.grantRole", () => {
  it("adds the role and emits OrganizationRoleGranted carrying issuedBy", () => {
    const result = OrganizationRolesRootOps.grantRole(
      OrganizationRolesRootOps.empty(userId, orgId),
      "admin",
      issuedBy,
    );
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(
      result.success.organizationRoles.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
      [{ role: "admin", issuedBy }],
    );
    const event = expectEvent(result.success.events, "OrganizationRoleGranted");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.organizationId, orgId);
    deepStrictEqual(event.role, "admin");
    deepStrictEqual(event.issuedBy, issuedBy);
  });

  it("fails AlreadyHasOrganizationRole when the role is already held", () => {
    const first = OrganizationRolesRootOps.grantRole(
      OrganizationRolesRootOps.empty(userId, orgId),
      "admin",
      issuedBy,
    );
    if (Result.isFailure(first)) throw new Error("expected Right");
    const second = OrganizationRolesRootOps.grantRole(
      first.success.organizationRoles,
      "admin",
      issuedBy,
    );
    deepStrictEqual(Result.isFailure(second), true);
    if (Result.isFailure(second)) {
      deepStrictEqual(second.failure instanceof AlreadyHasOrganizationRole, true);
    }
  });
});

describe("OrganizationRolesRootOps.revokeRole", () => {
  it("removes the role and emits OrganizationRoleRevoked", () => {
    const granted = OrganizationRolesRootOps.grantRole(
      OrganizationRolesRootOps.empty(userId, orgId),
      "admin",
      issuedBy,
    );
    if (Result.isFailure(granted)) throw new Error("expected Right");
    const result = OrganizationRolesRootOps.revokeRole(granted.success.organizationRoles, "admin");
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual([...result.success.organizationRoles.roles], []);
    const event = expectEvent(result.success.events, "OrganizationRoleRevoked");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.organizationId, orgId);
    deepStrictEqual(event.role, "admin");
  });

  it("fails DoesNotHaveOrganizationRole when the role isn't held", () => {
    const result = OrganizationRolesRootOps.revokeRole(
      OrganizationRolesRootOps.empty(userId, orgId),
      "admin",
    );
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof DoesNotHaveOrganizationRole, true);
    }
  });
});
