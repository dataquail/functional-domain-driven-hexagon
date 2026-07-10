import * as Schema from "effect/Schema";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `invitation.root-ops.ts` (`InvitationRootOps`) and predicates in
// `invitation.specification.ts` (`InvitationSpecifications`).
//
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
