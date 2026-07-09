import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type OrganizationNotFound } from "@/modules/organization/domain/organization.errors.js";
import { type OrganizationRoot } from "@/modules/organization/domain/organization.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Single-aggregate persistence port. `findOneById` filters out soft-deleted
// rows by default; `findOneByIdIncludingDeleted` is the explicit opt-in for
// the restore code path (the resource resolver registered for the
// `organization` resource uses this so policy checks can see deleted
// orgs without callers having to maintain two `resource` keys).
//
// `update` covers both write paths (rename + soft-delete + restore) —
// the aggregate produces the new state and the repo just persists.
export type OrganizationRepositoryShape = {
  readonly insertOne: (
    organization: OrganizationRoot,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (
    organization: OrganizationRoot,
  ) => Effect.Effect<void, OrganizationNotFound | PersistenceUnavailable>;
  readonly findOneById: (
    id: OrganizationId,
  ) => Effect.Effect<OrganizationRoot, OrganizationNotFound | PersistenceUnavailable>;
  readonly findOneByIdIncludingDeleted: (
    id: OrganizationId,
  ) => Effect.Effect<OrganizationRoot, OrganizationNotFound | PersistenceUnavailable>;
};

export class OrganizationRepository extends Context.Service<
  OrganizationRepository,
  OrganizationRepositoryShape
>()("OrganizationRepository") {}
