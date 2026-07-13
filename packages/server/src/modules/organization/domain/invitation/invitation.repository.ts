import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb persistence, collapsed to the minimal vocabulary: insert/update the
// aggregate, and read it back by a Specification. Every variant and identity
// lookup — by id, by token, the open invite for an (org, email) — is expressed
// as a spec at the call site (see InvitationSpecifications) and compiled to a
// WHERE fragment by the live repository. Absence is a plain `null`; mapping it
// to a domain 404 (InvitationNotFound / InvitationTokenNotFound) is the
// handler's job, since which not-found error applies depends on the use case.
export type InvitationRepositoryShape = {
  readonly insertOne: (invitation: InvitationRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (
    invitation: InvitationRoot,
  ) => Effect.Effect<void, InvitationNotFound | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<InvitationRoot>,
  ) => Effect.Effect<InvitationRoot | null, PersistenceUnavailable>;
  readonly findMany: (
    spec: Specification<InvitationRoot>,
  ) => Effect.Effect<ReadonlyArray<InvitationRoot>, PersistenceUnavailable>;
};

export class InvitationRepository extends Context.Service<
  InvitationRepository,
  InvitationRepositoryShape
>()("InvitationRepository") {}
