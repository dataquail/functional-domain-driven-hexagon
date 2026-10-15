import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable";
import { type Specification } from "@/globals/application/ddd/specification";
import { type OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors";
import { type OrganizationRoot } from "@/modules/organization/domain/organization/organization.root";

// Dumb persistence, collapsed to the minimal vocabulary: insert/update the
// aggregate, and read it back by a Specification. Identity lookups and the
// active-only filter are expressed as specs at the call site (see
// OrganizationSpecifications: `withId`, `notDeleted`) — the restore path reads
// the tombstone with `withId` alone, active-only flows compose it with
// `notDeleted`. Absence is `Option.none()`; mapping it to `OrganizationNotFound`
// is the caller's job.
//
// `update` covers both write paths (rename + soft-delete + restore) —
// the aggregate produces the new state and the repo just persists.
export type OrganizationRepositoryService = {
  readonly insertOne: (
    organization: OrganizationRoot,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (
    organization: OrganizationRoot,
  ) => Effect.Effect<void, OrganizationNotFound | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<OrganizationRoot>,
  ) => Effect.Effect<Option.Option<OrganizationRoot>, PersistenceUnavailable>;
};

export class OrganizationRepository extends Context.Service<
  OrganizationRepository,
  OrganizationRepositoryService
>()("OrganizationRepository") {}
