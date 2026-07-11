import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `organization.root-ops.ts` (`OrganizationRootOps`) and predicates in
// `organization.specification.ts` (`OrganizationSpecifications`).
export class OrganizationRoot extends Schema.Class<OrganizationRoot>("OrganizationRoot")({
  id: OrganizationId,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  // Soft-delete tombstone. Null = active. Set by `softDelete`, cleared
  // by `restore`. Reads filter on this column so callers don't see
  // tombstoned rows by default; the `restore` endpoint asks for them
  // explicitly via a flag on the read path.
  deletedAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}
