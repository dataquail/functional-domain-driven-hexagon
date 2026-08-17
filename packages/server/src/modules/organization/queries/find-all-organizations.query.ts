import { PersistenceUnavailable, Query } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

export const FindAllOrganizationsView = Schema.Struct({
  id: OrganizationId,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  deletedAt: Schema.NullOr(Schema.DateTimeUtc),
});
export type FindAllOrganizationsView = typeof FindAllOrganizationsView.Type;

export const FindAllOrganizationsResultView = Schema.Struct({
  organizations: Schema.Array(FindAllOrganizationsView),
  page: Schema.Number,
  pageSize: Schema.Number,
  total: Schema.Number,
});
export type FindAllOrganizationsResult = typeof FindAllOrganizationsResultView.Type;

// Admin-side listing of every org. `includeDeleted` is the explicit
// opt-in for the soft-delete recycling-bin view; by default the
// query filters tombstones out so the regular admin browse doesn't
// surface them.
export const FindAllOrganizationsQuery = Query.make("FindAllOrganizationsQuery", {
  payload: { page: Schema.Number, pageSize: Schema.Number, includeDeleted: Schema.Boolean },
  success: FindAllOrganizationsResultView,
  failure: PersistenceUnavailable,
});
export type FindAllOrganizationsPayload = Query.Payload<typeof FindAllOrganizationsQuery>;
