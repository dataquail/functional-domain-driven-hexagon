import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type Membership } from "@/modules/organization/domain/membership.aggregate.js";
import { type MembershipNotFound } from "@/modules/organization/domain/membership-errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
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
  readonly insert: (membership: Membership) => Effect.Effect<void, PersistenceUnavailable>;
  readonly delete: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<void, MembershipNotFound | PersistenceUnavailable>;
  readonly findByUserIdAndOrgId: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<Membership, MembershipNotFound | PersistenceUnavailable>;
};

export class MembershipRepository extends Context.Tag("MembershipRepository")<
  MembershipRepository,
  MembershipRepositoryShape
>() {}
