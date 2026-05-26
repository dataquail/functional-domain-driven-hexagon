import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Either from "effect/Either";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import {
  AlreadyHasOrganizationRole,
  DoesNotHaveOrganizationRole,
} from "./organization-role-errors.js";
import { type OrganizationRoleEvent } from "./organization-role-events.js";
import * as OrganizationRoles from "./organization-roles.aggregate.js";

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

describe("OrganizationRoles.empty", () => {
  it("constructs an aggregate with no roles", () => {
    const aggregate = OrganizationRoles.empty(userId, orgId);
    deepStrictEqual(aggregate.userId, userId);
    deepStrictEqual(aggregate.organizationId, orgId);
    deepStrictEqual([...aggregate.roles], []);
  });
});

describe("OrganizationRoles.hasRole", () => {
  it("returns false on an empty aggregate", () => {
    deepStrictEqual(
      OrganizationRoles.hasRole(OrganizationRoles.empty(userId, orgId), "admin"),
      false,
    );
  });

  it("returns true once the role is granted", () => {
    const result = OrganizationRoles.grantRole(
      OrganizationRoles.empty(userId, orgId),
      "admin",
      issuedBy,
    );
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual(OrganizationRoles.hasRole(result.right.organizationRoles, "admin"), true);
  });
});

describe("OrganizationRoles.grantRole", () => {
  it("adds the role and emits OrganizationRoleGranted carrying issuedBy", () => {
    const result = OrganizationRoles.grantRole(
      OrganizationRoles.empty(userId, orgId),
      "admin",
      issuedBy,
    );
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual(
      result.right.organizationRoles.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
      [{ role: "admin", issuedBy }],
    );
    const event = expectEvent(result.right.events, "OrganizationRoleGranted");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.organizationId, orgId);
    deepStrictEqual(event.role, "admin");
    deepStrictEqual(event.issuedBy, issuedBy);
  });

  it("fails AlreadyHasOrganizationRole when the role is already held", () => {
    const first = OrganizationRoles.grantRole(
      OrganizationRoles.empty(userId, orgId),
      "admin",
      issuedBy,
    );
    if (Either.isLeft(first)) throw new Error("expected Right");
    const second = OrganizationRoles.grantRole(first.right.organizationRoles, "admin", issuedBy);
    deepStrictEqual(Either.isLeft(second), true);
    if (Either.isLeft(second)) {
      deepStrictEqual(second.left instanceof AlreadyHasOrganizationRole, true);
    }
  });
});

describe("OrganizationRoles.revokeRole", () => {
  it("removes the role and emits OrganizationRoleRevoked", () => {
    const granted = OrganizationRoles.grantRole(
      OrganizationRoles.empty(userId, orgId),
      "admin",
      issuedBy,
    );
    if (Either.isLeft(granted)) throw new Error("expected Right");
    const result = OrganizationRoles.revokeRole(granted.right.organizationRoles, "admin");
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual([...result.right.organizationRoles.roles], []);
    const event = expectEvent(result.right.events, "OrganizationRoleRevoked");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.organizationId, orgId);
    deepStrictEqual(event.role, "admin");
  });

  it("fails DoesNotHaveOrganizationRole when the role isn't held", () => {
    const result = OrganizationRoles.revokeRole(OrganizationRoles.empty(userId, orgId), "admin");
    deepStrictEqual(Either.isLeft(result), true);
    if (Either.isLeft(result)) {
      deepStrictEqual(result.left instanceof DoesNotHaveOrganizationRole, true);
    }
  });
});
