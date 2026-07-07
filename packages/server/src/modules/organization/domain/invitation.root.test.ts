import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Either from "effect/Either";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationExpired,
  InvitationRevoked,
} from "./invitation.errors.js";
import { InvitationRootOps } from "./invitation.root.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
const inOneDay = DateTime.unsafeMake(new Date("2026-01-02T00:00:00Z"));
const inOneWeek = DateTime.unsafeMake(new Date("2026-01-08T00:00:00Z"));
const inputs = {
  id: invitationId,
  organizationId,
  inviteeEmail: "alice@example.com",
  token: "tok-abc",
  expiresAt: inOneWeek,
  now,
} as const;

describe("InvitationRootOps.issue", () => {
  it("constructs a pending invitation and emits InvitationIssued", () => {
    const { events, invitation } = InvitationRootOps.issue(inputs);
    deepStrictEqual(invitation.id, invitationId);
    deepStrictEqual(invitation.organizationId, organizationId);
    deepStrictEqual(invitation.inviteeEmail, "alice@example.com");
    deepStrictEqual(invitation.token, "tok-abc");
    deepStrictEqual(invitation.acceptedAt, null);
    deepStrictEqual(invitation.revokedAt, null);
    deepStrictEqual(events.length, 1);
    deepStrictEqual(events[0]?._tag, "InvitationIssued");
  });
});

describe("InvitationRootOps.accept", () => {
  const seed = () => InvitationRootOps.issue(inputs).invitation;

  it("sets acceptedAt, returns the new Membership, emits both events", () => {
    const result = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual(result.right.invitation.acceptedAt, inOneDay);
    deepStrictEqual(result.right.membership.userId, userId);
    deepStrictEqual(result.right.membership.organizationId, organizationId);
    const tags = result.right.events.map((e) => e._tag);
    deepStrictEqual(tags, ["InvitationAccepted", "MembershipCreated"]);
  });

  it("fails InvitationAlreadyAccepted when accepted twice", () => {
    const first = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Either.isLeft(first)) throw new Error("expected Right");
    const second = InvitationRootOps.accept(first.right.invitation, { userId, now: inOneDay });
    deepStrictEqual(Either.isLeft(second), true);
    if (Either.isLeft(second)) {
      deepStrictEqual(second.left instanceof InvitationAlreadyAccepted, true);
    }
  });

  it("fails InvitationRevoked when the invitation was revoked", () => {
    const revoked = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Either.isLeft(revoked)) throw new Error("expected Right");
    const result = InvitationRootOps.accept(revoked.right.invitation, { userId, now: inOneDay });
    deepStrictEqual(Either.isLeft(result), true);
    if (Either.isLeft(result)) {
      deepStrictEqual(result.left instanceof InvitationRevoked, true);
    }
  });

  it("fails InvitationExpired when now > expiresAt", () => {
    const past = DateTime.unsafeMake(new Date("2026-01-09T00:00:00Z"));
    const result = InvitationRootOps.accept(seed(), { userId, now: past });
    deepStrictEqual(Either.isLeft(result), true);
    if (Either.isLeft(result)) {
      deepStrictEqual(result.left instanceof InvitationExpired, true);
    }
  });
});

describe("InvitationRootOps.revoke", () => {
  const seed = () => InvitationRootOps.issue(inputs).invitation;

  it("sets revokedAt and emits InvitationRevoked", () => {
    const result = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual(result.right.invitation.revokedAt, inOneDay);
    deepStrictEqual(result.right.events[0]?._tag, "InvitationRevoked");
  });

  it("fails InvitationAlreadyAccepted when the invitation was accepted", () => {
    const accepted = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Either.isLeft(accepted)) throw new Error("expected Right");
    const result = InvitationRootOps.revoke(accepted.right.invitation, { now: inOneDay });
    deepStrictEqual(Either.isLeft(result), true);
    if (Either.isLeft(result)) {
      deepStrictEqual(result.left instanceof InvitationAlreadyAccepted, true);
    }
  });

  it("fails InvitationAlreadyRevoked on a second revoke", () => {
    const first = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Either.isLeft(first)) throw new Error("expected Right");
    const second = InvitationRootOps.revoke(first.right.invitation, { now: inOneDay });
    deepStrictEqual(Either.isLeft(second), true);
    if (Either.isLeft(second)) {
      deepStrictEqual(second.left instanceof InvitationAlreadyRevoked, true);
    }
  });
});

describe("InvitationRootOps.reissue", () => {
  const seed = () => InvitationRootOps.issue(inputs).invitation;
  const newExpiry = DateTime.unsafeMake(new Date("2026-01-15T00:00:00Z"));

  it("rotates the token, resets the expiry, and emits InvitationReissued", () => {
    const result = InvitationRootOps.reissue(seed(), {
      token: "tok-fresh",
      expiresAt: newExpiry,
      now: inOneDay,
    });
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual(result.right.invitation.token, "tok-fresh");
    deepStrictEqual(result.right.invitation.expiresAt, newExpiry);
    deepStrictEqual(result.right.invitation.acceptedAt, null);
    deepStrictEqual(result.right.invitation.revokedAt, null);
    deepStrictEqual(result.right.events[0]?._tag, "InvitationReissued");
  });

  it("re-issues an expired (but open) invitation", () => {
    const past = DateTime.unsafeMake(new Date("2026-02-01T00:00:00Z"));
    const result = InvitationRootOps.reissue(seed(), {
      token: "tok-fresh",
      expiresAt: newExpiry,
      now: past,
    });
    deepStrictEqual(Either.isRight(result), true);
  });

  it("fails InvitationAlreadyAccepted when the invitation was accepted", () => {
    const accepted = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Either.isLeft(accepted)) throw new Error("expected Right");
    const result = InvitationRootOps.reissue(accepted.right.invitation, {
      token: "tok-fresh",
      expiresAt: newExpiry,
      now: inOneDay,
    });
    deepStrictEqual(Either.isLeft(result), true);
    if (Either.isLeft(result)) {
      deepStrictEqual(result.left instanceof InvitationAlreadyAccepted, true);
    }
  });

  it("fails InvitationAlreadyRevoked when the invitation was revoked", () => {
    const revoked = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Either.isLeft(revoked)) throw new Error("expected Right");
    const result = InvitationRootOps.reissue(revoked.right.invitation, {
      token: "tok-fresh",
      expiresAt: newExpiry,
      now: inOneDay,
    });
    deepStrictEqual(Either.isLeft(result), true);
    if (Either.isLeft(result)) {
      deepStrictEqual(result.left instanceof InvitationAlreadyRevoked, true);
    }
  });
});

describe("InvitationRootOps.statusAt / isOpen", () => {
  const seed = () => InvitationRootOps.issue(inputs).invitation;

  it("an issued invitation is open and pending before expiry", () => {
    const inv = seed();
    deepStrictEqual(InvitationRootOps.isOpen(inv), true);
    deepStrictEqual(InvitationRootOps.statusAt(inv, inOneDay), "pending");
  });

  it("an open invitation past expiry reports expired", () => {
    const past = DateTime.unsafeMake(new Date("2026-02-01T00:00:00Z"));
    deepStrictEqual(InvitationRootOps.statusAt(seed(), past), "expired");
  });

  it("accepted and revoked invitations are not open", () => {
    const accepted = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Either.isLeft(accepted)) throw new Error("expected Right");
    deepStrictEqual(InvitationRootOps.isOpen(accepted.right.invitation), false);
    const revoked = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Either.isLeft(revoked)) throw new Error("expected Right");
    deepStrictEqual(InvitationRootOps.isOpen(revoked.right.invitation), false);
  });
});
