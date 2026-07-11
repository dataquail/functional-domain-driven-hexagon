import * as DateTime from "effect/DateTime";

import { type InvitationRoot } from "./invitation.root.js";

const isAccepted = (invitation: InvitationRoot): boolean => invitation.acceptedAt !== null;
const isRevoked = (invitation: InvitationRoot): boolean => invitation.revokedAt !== null;
const isExpiredAt = (invitation: InvitationRoot, now: DateTime.Utc): boolean =>
  DateTime.isLessThanOrEqualTo(invitation.expiresAt, now);

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

export const InvitationSpecifications = {
  isAccepted,
  isRevoked,
  isExpiredAt,
  isOpen,
  statusAt,
} as const;
