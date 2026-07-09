import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import {
  type InvitationNotFound,
  type InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation.errors.js";
import { type InvitationRoot } from "@/modules/organization/domain/invitation.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// `insert` is a fresh insert — the unique constraint on `token` will
// reject collisions (the command generates a high-entropy token, so a
// collision is a server defect that surfaces as a DatabaseError → die).
//
// `update` covers state transitions (accept/revoke/reissue) — the
// aggregate produces the new state, the repo persists it. Surfaces
// InvitationNotFound when the row is missing (likely a concurrent
// delete; commands treat this as a 404).
//
// `findOneByToken` is the read path for the anonymous accept endpoint
// (the caller doesn't know the invitation id, only the token).
//
// `findManyByOrganizationId` backs the pending-invitations list (the handler
// filters/derives status). `findOneOpenByOrganizationIdAndEmail` backs the
// invite-again-becomes-resend dedup: the `Open` qualifier (ADR-0024 permits a
// qualifier in front of the `By<Key>` clause) says it returns only the OPEN
// invitation — at most one open invite per (org, email) once dedup is in force —
// i.e. the most recent open one (or null), so the command can reissue instead
// of creating a duplicate.
export type InvitationRepositoryShape = {
  readonly insertOne: (invitation: InvitationRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly updateOne: (
    invitation: InvitationRoot,
  ) => Effect.Effect<void, InvitationNotFound | PersistenceUnavailable>;
  readonly findOneById: (
    id: InvitationId,
  ) => Effect.Effect<InvitationRoot, InvitationNotFound | PersistenceUnavailable>;
  readonly findOneByToken: (
    token: string,
  ) => Effect.Effect<InvitationRoot, InvitationTokenNotFound | PersistenceUnavailable>;
  readonly findManyByOrganizationId: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<InvitationRoot>, PersistenceUnavailable>;
  readonly findOneOpenByOrganizationIdAndEmail: (
    organizationId: OrganizationId,
    inviteeEmail: string,
  ) => Effect.Effect<InvitationRoot | null, PersistenceUnavailable>;
};

export class InvitationRepository extends Context.Service<
  InvitationRepository,
  InvitationRepositoryShape
>()("InvitationRepository") {}
