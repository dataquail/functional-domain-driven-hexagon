import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const OrganizationAuthzView = Schema.Struct({
  organizationId: OrganizationId,
});
export type OrganizationAuthzView = typeof OrganizationAuthzView.Type;

// Existence projection backing the `organization` authz resource. Soft-deleted
// rows are included: the restore endpoint has to resolve a tombstoned
// organization to decide whether the caller may act on it.
//
// Returns null rather than failing — absence is a fact about the read model, and
// the resolver is the layer that turns it into `NotFound`.
export const FindOrganizationByIdQuery = Query.make("FindOrganizationByIdQuery", {
  payload: { organizationId: OrganizationId },
  success: Schema.NullOr(OrganizationAuthzView),
  failure: PersistenceUnavailable,
});
export type FindOrganizationByIdPayload = Query.Payload<typeof FindOrganizationByIdQuery>;
