import * as Result from "effect/Result";

import { type DomainEvent } from "@/platform/ddd/contracts/domain-event.js";

import {
  type InvitationAlreadyAccepted,
  type InvitationExpired,
  type InvitationRevoked,
} from "../invitation/invitation.errors.js";
import { type InvitationRoot } from "../invitation/invitation.root.js";
import { type AcceptInput, InvitationRootOps } from "../invitation/invitation.root-ops.js";
import { type MembershipRoot } from "../membership/membership.root.js";
import { MembershipRootOps } from "../membership/membership.root-ops.js";

export type AcceptanceOutcome = {
  readonly invitation: InvitationRoot;
  readonly membership: MembershipRoot;
  // Both InvitationAccepted and MembershipCreated, dispatched under one
  // unit of work so subscribers see the pair atomically.
  readonly events: ReadonlyArray<DomainEvent>;
};

// Cross-subdomain orchestration: accepting an invitation makes the invitee
// a member. It spans the invitation and membership aggregates, so it is a
// domain service (ADR-0023) rather than an op on either root — the only
// domain location allowed to compose two subdomains. `accept` first runs
// the invitation's own guarded transition, then produces the membership.
const accept = (
  invitation: InvitationRoot,
  input: AcceptInput,
): Result.Result<
  AcceptanceOutcome,
  InvitationAlreadyAccepted | InvitationRevoked | InvitationExpired
> => {
  const accepted = InvitationRootOps.accept(invitation, input);
  if (Result.isFailure(accepted)) {
    return Result.fail(accepted.failure);
  }
  const { events: membershipEvents, membership } = MembershipRootOps.create({
    userId: input.userId,
    organizationId: invitation.organizationId,
    now: input.now,
  });
  return Result.succeed({
    invitation: accepted.success.invitation,
    membership,
    events: [...accepted.success.events, ...membershipEvents],
  });
};

export const InvitationAcceptance = { accept } as const;
