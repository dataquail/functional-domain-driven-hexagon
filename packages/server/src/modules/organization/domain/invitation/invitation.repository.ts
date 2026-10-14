import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import { type InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.ts";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.ts";

// Dumb persistence, collapsed to the minimal vocabulary: insert/update the
// aggregate, and read it back by a Specification. Every variant and identity
// lookup — by id, by token, the open invite for an (org, email) — is expressed
// as a spec at the call site (see InvitationSpecifications) and compiled to a
// WHERE fragment by the live repository. Absence is `Option.none()`; mapping it
// to a domain 404 (InvitationNotFound / InvitationTokenNotFound) is the
// handler's job, since which not-found error applies depends on the use case.
export type InvitationRepositoryService = {
  readonly insertOne: (invitation: InvitationRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (
    invitation: InvitationRoot,
  ) => Effect.Effect<void, InvitationNotFound | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<InvitationRoot>,
  ) => Effect.Effect<Option.Option<InvitationRoot>, PersistenceUnavailable>;
  readonly findMany: (
    spec: Specification<InvitationRoot>,
  ) => Effect.Effect<ReadonlyArray<InvitationRoot>, PersistenceUnavailable>;
};

export class InvitationRepository extends Context.Service<
  InvitationRepository,
  InvitationRepositoryService
>()("InvitationRepository") {}
