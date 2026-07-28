import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// The projection, written down as a schema rather than a bare type alias: this is a
// published cross-module contract (two other modules' ACL adapters read it), so the
// shape it promises deserves to be a contract and not just a shape.
export const MembershipView = Schema.Struct({ isMember: Schema.Boolean });
export type FindMembershipResult = typeof MembershipView.Type;

// Read-side "is this user a member of this org?" projection, published so other
// modules' authorization checks can ask it through their own ACL port (ADR-0022).
// Consumers dispatch it through the bus rather than reaching this module's
// tables, so the org module stays the single source of truth.
export const FindMembership = Query.make("FindMembershipQuery", {
  payload: { userId: UserId, organizationId: OrganizationId },
  success: MembershipView,
  failure: PersistenceUnavailable,
});
export type FindMembershipPayload = Query.Payload<typeof FindMembership>;
