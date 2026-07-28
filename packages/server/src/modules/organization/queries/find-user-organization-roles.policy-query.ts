import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const UserOrganizationRolesView = Schema.Struct({
  userId: UserId,
  organizationId: OrganizationId,
  roles: Schema.Array(Schema.String),
});
export type FindUserOrganizationRolesResult = typeof UserOrganizationRolesView.Type;

// Read-side projection of a user's roles within one organization.
// Returns an empty roles array if the user holds none — absence isn't
// NotFound. Role names are projected as bare strings; the read path
// trusts the DB (the write side is the sole validator) and the
// consuming policy service narrows to the roles it recognizes.
export const FindUserOrganizationRoles = Query.make("FindUserOrganizationRolesQuery", {
  payload: { userId: UserId, organizationId: OrganizationId },
  success: UserOrganizationRolesView,
  failure: PersistenceUnavailable,
});
export type FindUserOrganizationRolesPayload = Query.Payload<typeof FindUserOrganizationRoles>;
