import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import { type OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.ts";

// Dumb persistence, collapsed to upsert + spec-based read. The aggregate is
// multi-row (one `organization_roles` row per assigned role) keyed on the
// composite `(userId, organizationId)`. `findOne` compiles the spec to a WHERE,
// fetches the matching rows, and reconstitutes ONE aggregate — or `None` when
// no rows match. "No rows" is a valid "no roles yet" state, so the caller maps
// `None` to `OrganizationRolesRootOps.empty(...)`: the empty aggregate is a
// domain concern the repo can't synthesize from zero rows.
export type OrganizationRolesRepositoryService = {
  readonly upsertOne: (
    organizationRoles: OrganizationRolesRoot,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<OrganizationRolesRoot>,
  ) => Effect.Effect<Option.Option<OrganizationRolesRoot>, PersistenceUnavailable>;
};

export class OrganizationRolesRepository extends Context.Service<
  OrganizationRolesRepository,
  OrganizationRolesRepositoryService
>()("OrganizationRolesRepository") {}
