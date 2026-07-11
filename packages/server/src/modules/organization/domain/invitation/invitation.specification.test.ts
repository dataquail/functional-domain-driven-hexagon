import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRootOps } from "./invitation.root-ops.js";
import { InvitationSpecifications } from "./invitation.specification.js";

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

describe("InvitationSpecifications.statusAt / isOpen", () => {
  const seed = () => InvitationRootOps.issue(inputs).invitation;

  it("an issued invitation is open and pending before expiry", () => {
    const inv = seed();
    deepStrictEqual(InvitationSpecifications.isOpen(inv), true);
    deepStrictEqual(InvitationSpecifications.statusAt(inv, inOneDay), "pending");
  });

  it("an open invitation past expiry reports expired", () => {
    const past = DateTime.makeUnsafe(new Date("2026-02-01T00:00:00Z"));
    deepStrictEqual(InvitationSpecifications.statusAt(seed(), past), "expired");
  });

  it("accepted and revoked invitations are not open", () => {
    const accepted = InvitationRootOps.accept(seed(), { userId, now: inOneDay });
    if (Result.isFailure(accepted)) throw new Error("expected Right");
    deepStrictEqual(InvitationSpecifications.isOpen(accepted.success.invitation), false);
    const revoked = InvitationRootOps.revoke(seed(), { now: inOneDay });
    if (Result.isFailure(revoked)) throw new Error("expected Right");
    deepStrictEqual(InvitationSpecifications.isOpen(revoked.success.invitation), false);
  });
});
