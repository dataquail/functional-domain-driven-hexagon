import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `membership.root-ops.ts` (`MembershipRootOps`) and carry the test
// obligation.
//
// A user's presence in an organization. Identity = composite
// (userId, organizationId); enforced by the table's composite PK +
// the repository's idempotent insert (no in-aggregate set load).
//
// No aggregate-level invariants beyond construction: "this membership
// can't be created twice" is the PK; "this membership must exist
// before revoke" is a `MembershipNotFound` from the repository. There's
// no transitional state column on the row (revoke = delete), so
// revoke is a pure event-only operation.
export class MembershipRoot extends Schema.Class<MembershipRoot>("MembershipRoot")({
  userId: UserId,
  organizationId: OrganizationId,
  createdAt: Schema.DateTimeUtc,
}) {}
