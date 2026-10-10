import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { type UserId } from "@/globals/application/ddd/ids/user-id.js";
import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.js";
import { type Specification } from "@/globals/application/ddd/specification.js";
import { type MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { type MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";

// `insert` is idempotent — a duplicate (userId, organizationId) is a
// no-op (ON CONFLICT DO NOTHING). The PK enforces uniqueness; the
// upstream commands assume "create membership" can be re-driven without
// failing if the row already exists.
//
// `delete` returns `MembershipNotFound` when there's nothing to remove
// — `RemoveMemberCommand`/`LeaveOrganizationCommand` rely on that to surface a 404 to
// callers asking to remove a non-existent member.
//
// The composite (userId, organizationId) lookup is a spec at the call
// site (see MembershipSpecifications). Absence is a plain `null`; mapping
// it to `MembershipNotFound` is the caller's job.
export type MembershipRepositoryShape = {
  readonly insertOne: (membership: MembershipRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly deleteOne: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<void, MembershipNotFound | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<MembershipRoot>,
  ) => Effect.Effect<MembershipRoot | null, PersistenceUnavailable>;
};

export class MembershipRepository extends Context.Service<
  MembershipRepository,
  MembershipRepositoryShape
>()("MembershipRepository") {}
