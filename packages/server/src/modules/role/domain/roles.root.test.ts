import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Either from "effect/Either";

import { UserId } from "@/platform/ids/user-id.js";

import { AlreadyHasRole, DoesNotHaveRole } from "./role.errors.js";
import { type RoleEvent } from "./role.events.js";
import { RolesRootOps } from "./roles.root.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

const expectEvent = <T extends RoleEvent["_tag"]>(
  events: ReadonlyArray<RoleEvent>,
  tag: T,
): Extract<RoleEvent, { _tag: T }> => {
  const event = events[0];
  if (event?._tag !== tag) {
    throw new Error(`expected ${tag}, got ${String(event?._tag)}`);
  }
  return event as Extract<RoleEvent, { _tag: T }>;
};

describe("RolesRootOps.empty", () => {
  it("constructs an aggregate with no roles", () => {
    const aggregate = RolesRootOps.empty(userId);
    deepStrictEqual(aggregate.userId, userId);
    deepStrictEqual([...aggregate.roles], []);
  });
});

describe("RolesRootOps.hasRole", () => {
  it("returns false on an empty aggregate", () => {
    deepStrictEqual(RolesRootOps.hasRole(RolesRootOps.empty(userId), "super_admin"), false);
  });

  it("returns true after the role is granted", () => {
    const result = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual(RolesRootOps.hasRole(result.right.roles, "super_admin"), true);
  });
});

describe("RolesRootOps.grant", () => {
  it("adds the role and emits RoleGranted", () => {
    const result = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual([...result.right.roles.roles], ["super_admin"]);
    const event = expectEvent(result.right.events, "RoleGranted");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.role, "super_admin");
  });

  it("fails AlreadyHasRole when the role is already held", () => {
    const first = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Either.isLeft(first)) throw new Error("expected Right");
    const second = RolesRootOps.grant(first.right.roles, "super_admin");
    deepStrictEqual(Either.isLeft(second), true);
    if (Either.isLeft(second)) {
      deepStrictEqual(second.left instanceof AlreadyHasRole, true);
      deepStrictEqual(second.left.role, "super_admin");
    }
  });
});

describe("RolesRootOps.revoke", () => {
  it("removes the role and emits RoleRevoked", () => {
    const granted = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Either.isLeft(granted)) throw new Error("expected Right");
    const result = RolesRootOps.revoke(granted.right.roles, "super_admin");
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual([...result.right.roles.roles], []);
    const event = expectEvent(result.right.events, "RoleRevoked");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.role, "super_admin");
  });

  it("fails DoesNotHaveRole when the role isn't held", () => {
    const result = RolesRootOps.revoke(RolesRootOps.empty(userId), "super_admin");
    deepStrictEqual(Either.isLeft(result), true);
    if (Either.isLeft(result)) {
      deepStrictEqual(result.left instanceof DoesNotHaveRole, true);
    }
  });
});
