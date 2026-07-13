import * as DateTime from "effect/DateTime";

import {
  type Predicate,
  Spec,
  type Specification,
} from "@/platform/ddd/contracts/specification.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { type InvitationRoot } from "./invitation.root.js";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The field-name strings live here and in the mapper's
// column map; `Spec.eq`/`isNull` type them against InvitationRoot so a typo is
// a compile error.
const withId = (id: InvitationId): Specification<InvitationRoot> =>
  Spec.eq<InvitationRoot, "id">("id", id);
const withToken = (token: string): Specification<InvitationRoot> =>
  Spec.eq<InvitationRoot, "token">("token", token);
const forOrganization = (organizationId: OrganizationId): Specification<InvitationRoot> =>
  Spec.eq<InvitationRoot, "organizationId">("organizationId", organizationId);
const withInviteeEmail = (inviteeEmail: string): Specification<InvitationRoot> =>
  Spec.eq<InvitationRoot, "inviteeEmail">("inviteeEmail", inviteeEmail);

const isAccepted = Spec.isNotNull<InvitationRoot>("acceptedAt");
const isRevoked = Spec.isNotNull<InvitationRoot>("revokedAt");

// "Open" = not yet accepted and not revoked — the set invite-again/resend
// re-issue. Composed from the two terminal specs, so it filters in memory and
// compiles to `NOT (accepted_at IS NOT NULL OR revoked_at IS NOT NULL)`.
const isOpen = Spec.not(Spec.or(isAccepted, isRevoked));

// Eval-only (a `Predicate`, not a `Specification`): DateTime comparison has no
// Criteria node, and no repository filters invitations by expiry, so it never
// needs SQL translation. It stays a guard used in the aggregate ops.
const isExpiredAt =
  (now: DateTime.Utc): Predicate<InvitationRoot> =>
  (invitation) =>
    DateTime.isLessThanOrEqualTo(invitation.expiresAt, now);

export type InvitationStatus = "pending" | "expired";

// Display status for an *open* invitation. Accepted/revoked invitations are
// filtered out before this is called, so only live-vs-lapsed remains.
const statusAt = (invitation: InvitationRoot, now: DateTime.Utc): InvitationStatus =>
  isExpiredAt(now)(invitation) ? "expired" : "pending";

export const InvitationSpecifications = {
  withId,
  withToken,
  forOrganization,
  withInviteeEmail,
  isAccepted,
  isRevoked,
  isOpen,
  isExpiredAt,
  statusAt,
} as const;
