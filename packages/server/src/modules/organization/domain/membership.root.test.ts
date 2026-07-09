import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { type MembershipEvent } from "./membership.events.js";
import { MembershipRootOps } from "./membership.root.js";

const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));

const expectEvent = <T extends MembershipEvent["_tag"]>(
  events: ReadonlyArray<MembershipEvent>,
  tag: T,
): Extract<MembershipEvent, { _tag: T }> => {
  const event = events[0];
  if (event?._tag !== tag) {
    throw new Error(`expected ${tag}, got ${String(event?._tag)}`);
  }
  return event as Extract<MembershipEvent, { _tag: T }>;
};

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
