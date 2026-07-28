import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const FindMyOrganizationsView = Schema.Struct({
  id: OrganizationId,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  // Whether the caller holds the `admin` OrganizationRole in this org.
  // Drives the frontend's admin-only surfaces (Billing / Invite tabs,
  // member management) without a separate role probe.
  isAdmin: Schema.Boolean,
});
export type FindMyOrganizationsView = typeof FindMyOrganizationsView.Type;

export const FindMyOrganizationsResultView = Schema.Struct({
  organizations: Schema.Array(FindMyOrganizationsView),
});
export type FindMyOrganizationsResult = typeof FindMyOrganizationsResultView.Type;

// Lists the organizations the caller is a member of. Used by the
// frontend to resolve "which org am I working in" without needing to
// pass an orgId on every URL until the route reshape lands.
//
// Tombstoned orgs are filtered out — a soft-deleted org should not
// appear in the caller's chooser.
export const FindMyOrganizations = Query.make("FindMyOrganizationsQuery", {
  payload: { userId: UserId },
  success: FindMyOrganizationsResultView,
  failure: PersistenceUnavailable,
});
export type FindMyOrganizationsPayload = Query.Payload<typeof FindMyOrganizations>;
