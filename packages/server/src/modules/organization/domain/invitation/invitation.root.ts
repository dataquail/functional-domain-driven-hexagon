import * as Schema from "effect/Schema";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id";
import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `invitation.root-ops.ts` (`InvitationRootOps`) and predicates in
// `invitation.specification.ts` (`InvitationSpecifications`).
//
// State derived from columns. `acceptedAt`/`revokedAt` are terminal —
// once either is set, the invitation can't transition further. The
// composite-PK-like uniqueness of "one open invitation per
// (org, email)" isn't enforced here; the InviteUserCommand handler
// performs the duplicate-check via a repo lookup before issuing.
export class InvitationRoot extends Schema.Class<
  InvitationRoot,
  { readonly brand: "InvitationRoot" }
>("InvitationRoot")({
  id: InvitationId,
  organizationId: OrganizationId,
  inviteeEmail: Schema.String,
  token: Schema.String,
  expiresAt: Schema.DateTimeUtc,
  acceptedAt: Schema.Option(Schema.DateTimeUtc),
  revokedAt: Schema.Option(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
}) {}
