import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb persistence, collapsed to upsert + spec-based read. The aggregate is
// multi-row (one `organization_roles` row per assigned role) keyed on the
// composite `(userId, organizationId)`. `findOne` compiles the spec to a WHERE,
// fetches the matching rows, and reconstitutes ONE aggregate — or `null` when
// no rows match. "No rows" is a valid "no roles yet" state, so the caller maps
// `null` to `OrganizationRolesRootOps.empty(...)`: the empty aggregate is a
// domain concern the repo can't synthesize from zero rows.
export type OrganizationRolesRepositoryShape = {
  readonly upsertOne: (
    organizationRoles: OrganizationRolesRoot,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<OrganizationRolesRoot>,
  ) => Effect.Effect<OrganizationRolesRoot | null, PersistenceUnavailable>;
};

export class OrganizationRolesRepository extends Context.Service<
  OrganizationRolesRepository,
  OrganizationRolesRepositoryShape
>()("OrganizationRolesRepository") {}
