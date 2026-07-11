import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { type MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// `insert` is idempotent — a duplicate (userId, organizationId) is a
// no-op (ON CONFLICT DO NOTHING). The PK enforces uniqueness; the
// upstream commands assume "create membership" can be re-driven without
// failing if the row already exists.
//
// `delete` returns `MembershipNotFound` when there's nothing to remove
// — `RemoveMember`/`LeaveOrganization` rely on that to surface a 404 to
// callers asking to remove a non-existent member.
export type MembershipRepositoryShape = {
  readonly insertOne: (membership: MembershipRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly deleteOne: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<void, MembershipNotFound | PersistenceUnavailable>;
  readonly findOneByUserIdAndOrgId: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<MembershipRoot, MembershipNotFound | PersistenceUnavailable>;
  readonly findManyByOrganizationId: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<MembershipRoot>, PersistenceUnavailable>;
};

export class MembershipRepository extends Context.Service<
  MembershipRepository,
  MembershipRepositoryShape
>()("MembershipRepository") {}
