import { Query } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const OrganizationMemberView = Schema.Struct({
  userId: UserId,
  email: Schema.String,
  joinedAt: Schema.DateTimeUtc,
  isAdmin: Schema.Boolean,
});
export type OrganizationMemberView = typeof OrganizationMemberView.Type;

// Detailed membership view returned to the member-management surface
// (org-admin + super-admin). The handler reads its own schema directly
// (membership rows + admin role rows) and enriches each row with the
// user's email through the `UsersLookup` ACL — ADR-0020 disallows the
// cross-schema JOIN that would otherwise fetch it. The endpoint just
// dispatches through the QueryBus and maps the result to the contract.
export const FindOrganizationMembershipsQuery = Query.make("FindOrganizationMembershipsQuery", {
  payload: { organizationId: OrganizationId },
  success: Schema.Array(OrganizationMemberView),
  failure: PersistenceUnavailable,
});
export type FindOrganizationMembershipsPayload = Query.Payload<
  typeof FindOrganizationMembershipsQuery
>;
