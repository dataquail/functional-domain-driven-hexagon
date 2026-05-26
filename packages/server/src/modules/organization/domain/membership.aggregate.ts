import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { MembershipCreated, type MembershipEvent, MembershipRevoked } from "./membership-events.js";

// A user's presence in an organization. Identity = composite
// (userId, organizationId); enforced by the table's composite PK +
// the repository's idempotent insert (no in-aggregate set load).
//
// No aggregate-level invariants beyond construction: "this membership
// can't be created twice" is the PK; "this membership must exist
// before revoke" is a `MembershipNotFound` from the repository. There's
// no transitional state column on the row (revoke = delete), so
// revoke is a pure event-only operation.
export class Membership extends Schema.Class<Membership>("Membership")({
  userId: UserId,
  organizationId: OrganizationId,
  createdAt: Schema.DateTimeUtc,
}) {}

export type Result = {
  readonly membership: Membership;
  readonly events: ReadonlyArray<MembershipEvent>;
};

export type CreateInput = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly now: DateTime.Utc;
};

export const create = (input: CreateInput): Result => {
  const membership = Membership.make({
    userId: input.userId,
    organizationId: input.organizationId,
    createdAt: input.now,
  });
  return {
    membership,
    events: [
      MembershipCreated.make({
        userId: membership.userId,
        organizationId: membership.organizationId,
      }),
    ],
  };
};

export type RevokeResult = {
  readonly events: ReadonlyArray<MembershipEvent>;
};

export const revoke = (membership: Membership): RevokeResult => ({
  events: [
    MembershipRevoked.make({
      userId: membership.userId,
      organizationId: membership.organizationId,
    }),
  ],
});
