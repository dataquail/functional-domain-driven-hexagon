import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Existence projection backing the `organization` authz resource. Soft-deleted
// rows are included: the restore endpoint has to resolve a tombstoned
// organization to decide whether the caller may act on it.
//
// Returns null rather than failing — absence is a fact about the read model, and
// the resolver is the layer that turns it into `NotFound`.
export const FindOrganizationByIdQuery = Schema.TaggedStruct("FindOrganizationByIdQuery", {
  organizationId: OrganizationId,
});
export type FindOrganizationByIdQuery = typeof FindOrganizationByIdQuery.Type;

export type OrganizationAuthzView = {
  readonly organizationId: OrganizationId;
};

export const findOrganizationByIdQuerySpanAttributes: SpanAttributesExtractor<
  FindOrganizationByIdQuery
> = (query) => ({ "query.organizationId": query.organizationId });
