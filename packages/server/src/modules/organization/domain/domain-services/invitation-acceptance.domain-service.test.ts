import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationAlreadyAccepted, InvitationRevoked } from "../invitation/invitation.errors.js";
import { InvitationRootOps } from "../invitation/invitation.root-ops.js";
import { InvitationAcceptance } from "./invitation-acceptance.domain-service.js";

const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const inOneDay = DateTime.makeUnsafe(new Date("2026-01-02T00:00:00Z"));
const inOneWeek = DateTime.makeUnsafe(new Date("2026-01-08T00:00:00Z"));

const seed = () =>
  InvitationRootOps.issue({
    id: InvitationId.make("11111111-1111-1111-1111-111111111111"),
    organizationId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt: inOneWeek,
    now,
  }).invitation;

describe("InvitationAcceptance.accept", () => {
  it("accepts the invitation, produces the membership, and emits both events", () => {
    const result = InvitationAcceptance.accept(seed(), { userId, now: inOneDay });
    if (Result.isFailure(result)) throw new Error("expected success");
    deepStrictEqual(result.success.invitation.acceptedAt, inOneDay);
    deepStrictEqual(result.success.membership.userId, userId);
    deepStrictEqual(result.success.membership.organizationId, organizationId);
    const tags = result.success.events.map((e) => e._tag);
    deepStrictEqual(tags, ["InvitationAccepted", "MembershipCreated"]);
  });

  it("propagates the invitation's failure and produces no membership", () => {
    const accepted = InvitationAcceptance.accept(seed(), { userId, now: inOneDay });
    if (Result.isFailure(accepted)) throw new Error("expected success");
    const twice = InvitationAcceptance.accept(accepted.success.invitation, {
      userId,
      now: inOneDay,
    });
    deepStrictEqual(Result.isFailure(twice), true);
    if (Result.isFailure(twice)) {
      deepStrictEqual(twice.failure instanceof InvitationAlreadyAccepted, true);
    }
  });

  it("propagates InvitationRevoked", () => {
    const revoked = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Result.isFailure(revoked)) throw new Error("expected success");
    const result = InvitationAcceptance.accept(revoked.success.invitation, {
      userId,
      now: inOneDay,
    });
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof InvitationRevoked, true);
    }
  });
});
