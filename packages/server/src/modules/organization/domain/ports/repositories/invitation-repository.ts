import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type Invitation } from "@/modules/organization/domain/invitation.aggregate.js";
import {
  type InvitationNotFound,
  type InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
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
// `findByToken` is the read path for the anonymous accept endpoint
// (the caller doesn't know the invitation id, only the token).
//
// `findByOrganizationId` backs the pending-invitations list (the handler
// filters/derives status). `findOpenByOrganizationIdAndEmail` backs the
// invite-again-becomes-resend dedup: at most one open invite per
// (org, email) once dedup is in force; returns the most recent open one
// (or null) so the command can reissue instead of creating a duplicate.
export type InvitationRepositoryShape = {
  readonly insert: (invitation: Invitation) => Effect.Effect<void, PersistenceUnavailable>;
  readonly update: (
    invitation: Invitation,
  ) => Effect.Effect<void, InvitationNotFound | PersistenceUnavailable>;
  readonly findById: (
    id: InvitationId,
  ) => Effect.Effect<Invitation, InvitationNotFound | PersistenceUnavailable>;
  readonly findByToken: (
    token: string,
  ) => Effect.Effect<Invitation, InvitationTokenNotFound | PersistenceUnavailable>;
  readonly findByOrganizationId: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<Invitation>, PersistenceUnavailable>;
  readonly findOpenByOrganizationIdAndEmail: (
    organizationId: OrganizationId,
    inviteeEmail: string,
  ) => Effect.Effect<Invitation | null, PersistenceUnavailable>;
};

export class InvitationRepository extends Context.Tag("InvitationRepository")<
  InvitationRepository,
  InvitationRepositoryShape
>() {}
