import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Read-side "is this user a member of this org?" projection, published so other
// modules' authorization checks can ask it through their own ACL port (ADR-0022).
// Consumers dispatch it through the bus rather than reaching this module's
// tables, so the org module stays the single source of truth.
export const FindMembershipQuery = Schema.TaggedStruct("FindMembershipQuery", {
  userId: UserId,
  organizationId: OrganizationId,
});
export type FindMembershipQuery = typeof FindMembershipQuery.Type;

export type FindMembershipResult = {
  readonly isMember: boolean;
};

export const findMembershipQuerySpanAttributes: SpanAttributesExtractor<FindMembershipQuery> = (
  query,
) => ({ "query.userId": query.userId, "query.organizationId": query.organizationId });
