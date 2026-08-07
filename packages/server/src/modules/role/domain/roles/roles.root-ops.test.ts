import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
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
    const result = Result.getOrThrow(RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"));
    deepStrictEqual([...result.roles.roles], ["super_admin"]);
    const event = expectEvent(result.events, "RoleGranted");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.role, "super_admin");
  });

  it("fails AlreadyHasRole when the role is already held", () => {
    const first = Result.getOrThrow(RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"));
    const second = RolesRootOps.grant(first.roles, "super_admin");
    deepStrictEqual(Result.isFailure(second), true);
    if (Result.isFailure(second)) {
      deepStrictEqual(second.failure instanceof AlreadyHasRole, true);
      deepStrictEqual(second.failure.role, "super_admin");
    }
  });
});

describe("RolesRootOps.revoke", () => {
  it("removes the role and emits RoleRevoked", () => {
    const granted = Result.getOrThrow(
      RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"),
    );
    const result = Result.getOrThrow(RolesRootOps.revoke(granted.roles, "super_admin"));
    deepStrictEqual([...result.roles.roles], []);
    const event = expectEvent(result.events, "RoleRevoked");
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
