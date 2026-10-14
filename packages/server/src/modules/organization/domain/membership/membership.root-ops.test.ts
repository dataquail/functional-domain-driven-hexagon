import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";

import { type MembershipEvent } from "./membership.events.js";
import { MembershipRootOps } from "./membership.root-ops.js";

const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");

const expectEvent = <T extends MembershipEvent["_tag"]>(
  events: ReadonlyArray<MembershipEvent>,
  tag: T,
): Extract<MembershipEvent, { _tag: T }> =>
  Option.getOrThrow(
    Option.filter(Arr.head(events), (event): event is Extract<MembershipEvent, { _tag: T }> =>
      Predicate.isTagged(event, tag),
    ),
  );

describe("MembershipRootOps.create", () => {
  it("sets userId, organizationId, createdAt", () => {
    const { membership } = MembershipRootOps.create({ userId, organizationId, now });
    deepStrictEqual(membership.userId, userId);
    deepStrictEqual(membership.organizationId, organizationId);
    deepStrictEqual(membership.createdAt, now);
  });

  it("emits MembershipCreated", () => {
    const { events } = MembershipRootOps.create({ userId, organizationId, now });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "MembershipCreated");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.organizationId, organizationId);
  });
});

describe("MembershipRootOps.revoke", () => {
  it("emits MembershipRevoked", () => {
    const { membership } = MembershipRootOps.create({ userId, organizationId, now });
    const { events } = MembershipRootOps.revoke(membership);
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "MembershipRevoked");
    deepStrictEqual(event.userId, userId);
    deepStrictEqual(event.organizationId, organizationId);
  });
});
