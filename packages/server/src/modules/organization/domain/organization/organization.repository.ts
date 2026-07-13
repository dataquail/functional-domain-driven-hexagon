import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { type OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb persistence, collapsed to the minimal vocabulary: insert/update the
// aggregate, and read it back by a Specification. Identity lookups and the
// active-only filter are expressed as specs at the call site (see
// OrganizationSpecifications: `withId`, `notDeleted`) — the restore path reads
// the tombstone with `withId` alone, active-only flows compose it with
// `notDeleted`. Absence is a plain `null`; mapping it to `OrganizationNotFound`
// is the caller's job.
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
  readonly findOne: (
    spec: Specification<OrganizationRoot>,
  ) => Effect.Effect<OrganizationRoot | null, PersistenceUnavailable>;
};

export class OrganizationRepository extends Context.Service<
  OrganizationRepository,
  OrganizationRepositoryShape
>()("OrganizationRepository") {}
