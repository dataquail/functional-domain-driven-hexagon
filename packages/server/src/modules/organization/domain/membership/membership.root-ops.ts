import type * as DateTime from "effect/DateTime";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { type UserId } from "@/globals/application/ddd/ids/user-id.ts";

import { MembershipCreated, type MembershipEvent, MembershipRevoked } from "./membership.events.ts";
import { MembershipRoot } from "./membership.root.ts";

export type Result = {
  readonly membership: MembershipRoot;
  readonly events: ReadonlyArray<MembershipEvent>;
};

export type CreateInput = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly now: DateTime.Utc;
};

const create = (input: CreateInput): Result => {
  const membership = MembershipRoot.make({
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

const revoke = (membership: MembershipRoot): RevokeResult => ({
  events: [
    MembershipRevoked.make({
      userId: membership.userId,
      organizationId: membership.organizationId,
    }),
  ],
});

export const MembershipRootOps = { create, revoke } as const;
