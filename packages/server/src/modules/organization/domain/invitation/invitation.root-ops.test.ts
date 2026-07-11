import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationExpired,
  InvitationRevoked,
} from "./invitation.errors.js";
import { InvitationRootOps } from "./invitation.root-ops.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const inOneDay = DateTime.makeUnsafe(new Date("2026-01-02T00:00:00Z"));
const inOneWeek = DateTime.makeUnsafe(new Date("2026-01-08T00:00:00Z"));
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

  it("sets acceptedAt and emits InvitationAccepted (membership is the domain service's job)", () => {
    const result = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(result.success.invitation.acceptedAt, inOneDay);
    const tags = result.success.events.map((e) => e._tag);
    deepStrictEqual(tags, ["InvitationAccepted"]);
  });

  it("fails InvitationAlreadyAccepted when accepted twice", () => {
    const first = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Result.isFailure(first)) throw new Error("expected Right");
    const second = InvitationRootOps.accept(first.success.invitation, { userId, now: inOneDay });
    deepStrictEqual(Result.isFailure(second), true);
    if (Result.isFailure(second)) {
      deepStrictEqual(second.failure instanceof InvitationAlreadyAccepted, true);
    }
  });

  it("fails InvitationRevoked when the invitation was revoked", () => {
    const revoked = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Result.isFailure(revoked)) throw new Error("expected Right");
    const result = InvitationRootOps.accept(revoked.success.invitation, { userId, now: inOneDay });
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof InvitationRevoked, true);
    }
  });

  it("fails InvitationExpired when now > expiresAt", () => {
    const past = DateTime.makeUnsafe(new Date("2026-01-09T00:00:00Z"));
    const result = InvitationRootOps.accept(seed(), { userId, now: past });
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof InvitationExpired, true);
    }
  });
});

describe("InvitationRootOps.revoke", () => {
  const seed = () => InvitationRootOps.issue(inputs).invitation;

  it("sets revokedAt and emits InvitationRevoked", () => {
    const result = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(result.success.invitation.revokedAt, inOneDay);
    deepStrictEqual(result.success.events[0]?._tag, "InvitationRevoked");
  });

  it("fails InvitationAlreadyAccepted when the invitation was accepted", () => {
    const accepted = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Result.isFailure(accepted)) throw new Error("expected Right");
    const result = InvitationRootOps.revoke(accepted.success.invitation, { now: inOneDay });
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof InvitationAlreadyAccepted, true);
    }
  });

  it("fails InvitationAlreadyRevoked on a second revoke", () => {
    const first = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Result.isFailure(first)) throw new Error("expected Right");
    const second = InvitationRootOps.revoke(first.success.invitation, { now: inOneDay });
    deepStrictEqual(Result.isFailure(second), true);
    if (Result.isFailure(second)) {
      deepStrictEqual(second.failure instanceof InvitationAlreadyRevoked, true);
    }
  });
});

describe("InvitationRootOps.reissue", () => {
  const seed = () => InvitationRootOps.issue(inputs).invitation;
  const newExpiry = DateTime.makeUnsafe(new Date("2026-01-15T00:00:00Z"));

  it("rotates the token, resets the expiry, and emits InvitationReissued", () => {
    const result = InvitationRootOps.reissue(seed(), {
      token: "tok-fresh",
      expiresAt: newExpiry,
      now: inOneDay,
    });
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(result.success.invitation.token, "tok-fresh");
    deepStrictEqual(result.success.invitation.expiresAt, newExpiry);
    deepStrictEqual(result.success.invitation.acceptedAt, null);
    deepStrictEqual(result.success.invitation.revokedAt, null);
    deepStrictEqual(result.success.events[0]?._tag, "InvitationReissued");
  });

  it("re-issues an expired (but open) invitation", () => {
    const past = DateTime.makeUnsafe(new Date("2026-02-01T00:00:00Z"));
    const result = InvitationRootOps.reissue(seed(), {
      token: "tok-fresh",
      expiresAt: newExpiry,
      now: past,
    });
    deepStrictEqual(Result.isSuccess(result), true);
  });

  it("fails InvitationAlreadyAccepted when the invitation was accepted", () => {
    const accepted = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Result.isFailure(accepted)) throw new Error("expected Right");
    const result = InvitationRootOps.reissue(accepted.success.invitation, {
      token: "tok-fresh",
      expiresAt: newExpiry,
      now: inOneDay,
    });
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof InvitationAlreadyAccepted, true);
    }
  });

  it("fails InvitationAlreadyRevoked when the invitation was revoked", () => {
    const revoked = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Result.isFailure(revoked)) throw new Error("expected Right");
    const result = InvitationRootOps.reissue(revoked.success.invitation, {
      token: "tok-fresh",
      expiresAt: newExpiry,
      now: inOneDay,
    });
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof InvitationAlreadyRevoked, true);
    }
  });
});
