import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";
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
} from "./invitation.errors.js";
import {
  InvitationAccepted,
  type InvitationEvent,
  InvitationIssued,
  InvitationReissued,
  InvitationRevoked,
} from "./invitation.events.js";
import { type MembershipRoot, MembershipRootOps } from "./membership.root.js";

// State derived from columns. `acceptedAt`/`revokedAt` are terminal —
// once either is set, the invitation can't transition further. The
// composite-PK-like uniqueness of "one open invitation per
// (org, email)" isn't enforced here; the InviteUser command handler
// performs the duplicate-check via a repo lookup before issuing.
export class InvitationRoot extends Schema.Class<InvitationRoot>("InvitationRoot")({
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
  readonly invitation: InvitationRoot;
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

const issue = (input: IssueInput): IssueResult => {
  const invitation = InvitationRoot.make({
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

const isAccepted = (invitation: InvitationRoot): boolean => invitation.acceptedAt !== null;
const isRevoked = (invitation: InvitationRoot): boolean => invitation.revokedAt !== null;
const isExpiredAt = (invitation: InvitationRoot, now: DateTime.Utc): boolean =>
  DateTime.lessThanOrEqualTo(invitation.expiresAt, now);

// "Open" = not yet accepted and not revoked — the set of invitations the
// pending-list surfaces and that invite-again/resend re-issue. An open
// invite is still further classified by `statusAt` as pending vs expired.
const isOpen = (invitation: InvitationRoot): boolean =>
  !isAccepted(invitation) && !isRevoked(invitation);

export type InvitationStatus = "pending" | "expired";

// Display status for an *open* invitation. Accepted/revoked invitations
// are filtered out before this is called (they aren't part of the
// pending list), so only the live-vs-lapsed distinction remains.
const statusAt = (invitation: InvitationRoot, now: DateTime.Utc): InvitationStatus =>
  isExpiredAt(invitation, now) ? "expired" : "pending";

export type AcceptInput = {
  readonly userId: UserId;
  readonly now: DateTime.Utc;
};

export type AcceptResult = {
  readonly invitation: InvitationRoot;
  readonly membership: MembershipRoot;
  // The union here is just `DomainEvent` at the bus boundary — the
  // handler dispatches both the InvitationAccepted and MembershipCreated
  // events under the same unit of work so subscribers see the pair
  // atomically.
  readonly events: ReadonlyArray<DomainEvent>;
};

// Aggregate-protected invariant: accept fails if the invitation is
// already terminal (accepted/revoked) or past its expiration. Produces
// a MembershipRoot in the same step — the only way to consume an invite
// is to become a member.
const accept = (
  invitation: InvitationRoot,
  input: AcceptInput,
): Result.Result<
  AcceptResult,
  InvitationAlreadyAccepted | InvitationRevokedError | InvitationExpired
> => {
  if (isAccepted(invitation)) {
    return Result.fail(new InvitationAlreadyAccepted({ invitationId: invitation.id }));
  }
  if (isRevoked(invitation)) {
    return Result.fail(new InvitationRevokedError({ invitationId: invitation.id }));
  }
  if (isExpiredAt(invitation, input.now)) {
    return Result.fail(new InvitationExpired({ invitationId: invitation.id }));
  }
  const updated = InvitationRoot.make({
    id: invitation.id,
    organizationId: invitation.organizationId,
    inviteeEmail: invitation.inviteeEmail,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    acceptedAt: input.now,
    revokedAt: null,
    createdAt: invitation.createdAt,
  });
  const { events: membershipEvents, membership } = MembershipRootOps.create({
    userId: input.userId,
    organizationId: invitation.organizationId,
    now: input.now,
  });
  return Result.succeed({
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
  readonly invitation: InvitationRoot;
  readonly events: ReadonlyArray<InvitationEvent>;
};

// Aggregate-protected invariant: revoke fails if the invitation is
// already accepted (need RemoveMember instead) or already revoked
// (idempotent-by-accident would mask UI double-clicks; same pattern
// as `OrganizationRootOps.softDelete` failing AlreadyDeleted).
const revoke = (
  invitation: InvitationRoot,
  input: RevokeInput,
): Result.Result<RevokeResult, InvitationAlreadyAccepted | InvitationAlreadyRevoked> => {
  if (isAccepted(invitation)) {
    return Result.fail(new InvitationAlreadyAccepted({ invitationId: invitation.id }));
  }
  if (isRevoked(invitation)) {
    return Result.fail(new InvitationAlreadyRevoked({ invitationId: invitation.id }));
  }
  const updated = InvitationRoot.make({
    id: invitation.id,
    organizationId: invitation.organizationId,
    inviteeEmail: invitation.inviteeEmail,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    acceptedAt: null,
    revokedAt: input.now,
    createdAt: invitation.createdAt,
  });
  return Result.succeed({
    invitation: updated,
    events: [
      InvitationRevoked.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
      }),
    ],
  });
};

export type ReissueInput = {
  readonly token: string;
  readonly expiresAt: DateTime.Utc;
  readonly now: DateTime.Utc;
};

export type ReissueResult = {
  readonly invitation: InvitationRoot;
  readonly events: ReadonlyArray<InvitationEvent>;
};

// Aggregate-protected invariant: re-issue rotates the token and resets
// the expiry on an *open* invitation (the resend action, and the
// invite-again-for-an-existing-email path). Fails on a terminal
// invitation — accepted (the invitee already joined; use RemoveMember)
// or revoked (gone; issue a fresh invite instead). The old token is
// discarded, so any previously-sent accept link stops working.
const reissue = (
  invitation: InvitationRoot,
  input: ReissueInput,
): Result.Result<ReissueResult, InvitationAlreadyAccepted | InvitationAlreadyRevoked> => {
  if (isAccepted(invitation)) {
    return Result.fail(new InvitationAlreadyAccepted({ invitationId: invitation.id }));
  }
  if (isRevoked(invitation)) {
    return Result.fail(new InvitationAlreadyRevoked({ invitationId: invitation.id }));
  }
  const updated = InvitationRoot.make({
    id: invitation.id,
    organizationId: invitation.organizationId,
    inviteeEmail: invitation.inviteeEmail,
    token: input.token,
    expiresAt: input.expiresAt,
    acceptedAt: null,
    revokedAt: null,
    createdAt: invitation.createdAt,
  });
  return Result.succeed({
    invitation: updated,
    events: [
      InvitationReissued.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        inviteeEmail: invitation.inviteeEmail,
      }),
    ],
  });
};

export const InvitationRootOps = {
  issue,
  isAccepted,
  isRevoked,
  isExpiredAt,
  isOpen,
  statusAt,
  accept,
  revoke,
  reissue,
} as const;
