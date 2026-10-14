import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";

import { AlreadyHasRole, DoesNotHaveRole } from "./role.errors.ts";
import { type RoleEvent, RoleGranted, RoleRevoked } from "./role.events.ts";
import { RolesRootOps } from "./roles.root-ops.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");

const expectFirstEvent = <S extends Schema.Constraint>(
  events: ReadonlyArray<RoleEvent>,
  schema: S,
): RoleEvent & S["Type"] => Option.getOrThrow(Option.filter(Arr.head(events), Schema.is(schema)));

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
    const event = expectFirstEvent(result.events, RoleGranted.schema);
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.role, "super_admin");
  });

  it("fails AlreadyHasRole when the role is already held", () => {
    const first = Result.getOrThrow(RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin"));
    const second = RolesRootOps.grant(first.roles, "super_admin");
    deepStrictEqual(Result.isFailure(second), true);

    if (Result.isFailure(second)) {
      deepStrictEqual(Schema.is(AlreadyHasRole)(second.failure), true);
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
    const event = expectFirstEvent(result.events, RoleRevoked.schema);
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.role, "super_admin");
  });

  it("fails DoesNotHaveRole when the role isn't held", () => {
    const result = RolesRootOps.revoke(RolesRootOps.empty(userId), "super_admin");
    deepStrictEqual(Result.isFailure(result), true);

    if (Result.isFailure(result)) {
      deepStrictEqual(Schema.is(DoesNotHaveRole)(result.failure), true);
    }
  });
});
