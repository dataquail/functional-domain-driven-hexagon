import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type Organization } from "@/modules/organization/domain/organization.aggregate.js";
import { type OrganizationNotFound } from "@/modules/organization/domain/organization-errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Single-aggregate persistence port. `findById` filters out soft-deleted
// rows by default; `findByIdIncludingDeleted` is the explicit opt-in for
// the restore code path (the resource resolver registered for the
// `organization` resource uses this so policy checks can see deleted
// orgs without callers having to maintain two `resource` keys).
//
// `update` covers both write paths (rename + soft-delete + restore) —
// the aggregate produces the new state and the repo just persists.
export type OrganizationRepositoryShape = {
  readonly insert: (organization: Organization) => Effect.Effect<void, PersistenceUnavailable>;
  readonly update: (
    organization: Organization,
  ) => Effect.Effect<void, OrganizationNotFound | PersistenceUnavailable>;
  readonly findById: (
    id: OrganizationId,
  ) => Effect.Effect<Organization, OrganizationNotFound | PersistenceUnavailable>;
  readonly findByIdIncludingDeleted: (
    id: OrganizationId,
  ) => Effect.Effect<Organization, OrganizationNotFound | PersistenceUnavailable>;
};

export class OrganizationRepository extends Context.Tag("OrganizationRepository")<
  OrganizationRepository,
  OrganizationRepositoryShape
>() {}
