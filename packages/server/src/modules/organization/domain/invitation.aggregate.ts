import * as DateTime from "effect/DateTime";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { type DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationExpired,
  InvitationRevoked as InvitationRevokedError,
} from "./invitation-errors.js";
import {
  InvitationAccepted,
  type InvitationEvent,
  InvitationIssued,
  InvitationRevoked,
} from "./invitation-events.js";
import * as Membership from "./membership.aggregate.js";

// State derived from columns. `acceptedAt`/`revokedAt` are terminal —
// once either is set, the invitation can't transition further. The
// composite-PK-like uniqueness of "one open invitation per
// (org, email)" isn't enforced here; the InviteUser command handler
// performs the duplicate-check via a repo lookup before issuing.
export class Invitation extends Schema.Class<Invitation>("Invitation")({
  id: InvitationId,
  organizationId: OrganizationId,
  inviteeEmail: Schema.String,
  token: Schema.String,
  expiresAt: Schema.DateTimeUtc,
  acceptedAt: Schema.NullOr(Schema.DateTimeUtc),
  revokedAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
}) {}

export type IssueResult = {
  readonly invitation: Invitation;
  readonly events: ReadonlyArray<InvitationEvent>;
};

export type IssueInput = {
  readonly id: InvitationId;
  readonly organizationId: OrganizationId;
  readonly inviteeEmail: string;
  readonly token: string;
  readonly expiresAt: DateTime.Utc;
  readonly now: DateTime.Utc;
};

export const issue = (input: IssueInput): IssueResult => {
  const invitation = Invitation.make({
    id: input.id,
    organizationId: input.organizationId,
    inviteeEmail: input.inviteeEmail,
    token: input.token,
    expiresAt: input.expiresAt,
    acceptedAt: null,
    revokedAt: null,
    createdAt: input.now,
  });
  return {
    invitation,
    events: [
      InvitationIssued.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        inviteeEmail: invitation.inviteeEmail,
      }),
    ],
  };
};

export const isAccepted = (invitation: Invitation): boolean => invitation.acceptedAt !== null;
export const isRevoked = (invitation: Invitation): boolean => invitation.revokedAt !== null;
export const isExpiredAt = (invitation: Invitation, now: DateTime.Utc): boolean =>
  DateTime.lessThanOrEqualTo(invitation.expiresAt, now);

export type AcceptInput = {
  readonly userId: UserId;
  readonly now: DateTime.Utc;
};

export type AcceptResult = {
  readonly invitation: Invitation;
  readonly membership: Membership.Membership;
  // The union here is just `DomainEvent` at the bus boundary — the
  // handler dispatches both the InvitationAccepted and MembershipCreated
  // events under the same unit of work so subscribers see the pair
  // atomically.
  readonly events: ReadonlyArray<DomainEvent>;
};

// Aggregate-protected invariant: accept fails if the invitation is
// already terminal (accepted/revoked) or past its expiration. Produces
// a Membership in the same step — the only way to consume an invite is
// to become a member.
export const accept = (
  invitation: Invitation,
  input: AcceptInput,
): Either.Either<
  AcceptResult,
  InvitationAlreadyAccepted | InvitationRevokedError | InvitationExpired
> => {
  if (isAccepted(invitation)) {
    return Either.left(new InvitationAlreadyAccepted({ invitationId: invitation.id }));
  }
  if (isRevoked(invitation)) {
    return Either.left(new InvitationRevokedError({ invitationId: invitation.id }));
  }
  if (isExpiredAt(invitation, input.now)) {
    return Either.left(new InvitationExpired({ invitationId: invitation.id }));
  }
  const updated = Invitation.make({
    id: invitation.id,
    organizationId: invitation.organizationId,
    inviteeEmail: invitation.inviteeEmail,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    acceptedAt: input.now,
    revokedAt: null,
    createdAt: invitation.createdAt,
  });
  const { events: membershipEvents, membership } = Membership.create({
    userId: input.userId,
    organizationId: invitation.organizationId,
    now: input.now,
  });
  return Either.right({
    invitation: updated,
    membership,
    events: [
      InvitationAccepted.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        userId: input.userId,
      }),
      ...membershipEvents,
    ],
  });
};

export type RevokeInput = { readonly now: DateTime.Utc };

export type RevokeResult = {
  readonly invitation: Invitation;
  readonly events: ReadonlyArray<InvitationEvent>;
};

// Aggregate-protected invariant: revoke fails if the invitation is
// already accepted (need RemoveMember instead) or already revoked
// (idempotent-by-accident would mask UI double-clicks; same pattern
// as `Organization.softDelete` failing AlreadyDeleted).
export const revoke = (
  invitation: Invitation,
  input: RevokeInput,
): Either.Either<RevokeResult, InvitationAlreadyAccepted | InvitationAlreadyRevoked> => {
  if (isAccepted(invitation)) {
    return Either.left(new InvitationAlreadyAccepted({ invitationId: invitation.id }));
  }
  if (isRevoked(invitation)) {
    return Either.left(new InvitationAlreadyRevoked({ invitationId: invitation.id }));
  }
  const updated = Invitation.make({
    id: invitation.id,
    organizationId: invitation.organizationId,
    inviteeEmail: invitation.inviteeEmail,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    acceptedAt: null,
    revokedAt: input.now,
    createdAt: invitation.createdAt,
  });
  return Either.right({
    invitation: updated,
    events: [
      InvitationRevoked.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
      }),
    ],
  });
};
