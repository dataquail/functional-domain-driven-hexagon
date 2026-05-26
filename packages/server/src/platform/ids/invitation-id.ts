import * as Schema from "effect/Schema";

// Canonical server-internal InvitationId. Lives in the platform shared
// kernel — narrowly allowlisted by the four layer-isolation dep-cruiser
// rules — so modules don't end up redeclaring the brand and drifting.
// See ADR-0002 ("typed-ID shared kernel" addendum). Same scope rules as
// UserId/OrganizationId: branded entity IDs only.
export const InvitationId = Schema.String.pipe(Schema.brand("InvitationId"));
export type InvitationId = typeof InvitationId.Type;
