import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Read-side "is this user a member of this org?" projection. Backs the
// platform-layer `MembershipService` ACL: `MembershipServiceLive`
// dispatches this query through the bus so the membership determination
// is an explicit cross-module query against the org module (the single
// source of truth), not an in-process repo reach.
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
