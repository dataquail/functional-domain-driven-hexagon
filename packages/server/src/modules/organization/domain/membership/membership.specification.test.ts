import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { MembershipRootOps } from "./membership.root-ops.js";
import { MembershipSpecifications } from "./membership.specification.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
const otherOrganizationId = OrganizationId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));

const seed = () => MembershipRootOps.create({ userId, organizationId, now }).membership;

describe("MembershipSpecifications.forUser", () => {
  it("matches only the given user and carries an Eq criteria", () => {
    const membership = seed();
    deepStrictEqual(MembershipSpecifications.forUser(userId)(membership), true);
    deepStrictEqual(MembershipSpecifications.forUser(otherUserId)(membership), false);
    deepStrictEqual(MembershipSpecifications.forUser(userId).criteria, {
      _tag: "Eq",
      field: "userId",
      value: userId,
    });
  });
});

describe("MembershipSpecifications.forOrganization", () => {
  it("matches only the given organization and carries an Eq criteria", () => {
    const membership = seed();
    deepStrictEqual(MembershipSpecifications.forOrganization(organizationId)(membership), true);
    deepStrictEqual(
      MembershipSpecifications.forOrganization(otherOrganizationId)(membership),
      false,
    );
    deepStrictEqual(MembershipSpecifications.forOrganization(organizationId).criteria, {
      _tag: "Eq",
      field: "organizationId",
      value: organizationId,
    });
  });
});
