import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Result from "effect/Result";

import { UserId } from "@/platform/ids/user-id.js";

import { AlreadyHasRole, DoesNotHaveRole } from "./role.errors.js";
import { type RoleEvent } from "./role.events.js";
import { RolesRootOps } from "./roles.root-ops.js";

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

describe("RolesRootOps.grant", () => {
  it("adds the role and emits RoleGranted", () => {
    const result = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual([...result.success.roles.roles], ["super_admin"]);
    const event = expectEvent(result.success.events, "RoleGranted");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.role, "super_admin");
  });

  it("fails AlreadyHasRole when the role is already held", () => {
    const first = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Result.isFailure(first)) throw new Error("expected Right");
    const second = RolesRootOps.grant(first.success.roles, "super_admin");
    deepStrictEqual(Result.isFailure(second), true);
    if (Result.isFailure(second)) {
      deepStrictEqual(second.failure instanceof AlreadyHasRole, true);
      deepStrictEqual(second.failure.role, "super_admin");
    }
  });
});

describe("RolesRootOps.revoke", () => {
  it("removes the role and emits RoleRevoked", () => {
    const granted = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin");
    if (Result.isFailure(granted)) throw new Error("expected Right");
    const result = RolesRootOps.revoke(granted.success.roles, "super_admin");
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual([...result.success.roles.roles], []);
    const event = expectEvent(result.success.events, "RoleRevoked");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.role, "super_admin");
  });

  it("fails DoesNotHaveRole when the role isn't held", () => {
    const result = RolesRootOps.revoke(RolesRootOps.empty(userId), "super_admin");
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof DoesNotHaveRole, true);
    }
  });
});
