import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Lists the organizations the caller is a member of. Used by the
// frontend to resolve "which org am I working in" without needing to
// pass an orgId on every URL until the route reshape lands.
//
// Tombstoned orgs are filtered out — a soft-deleted org should not
// appear in the caller's chooser.
export const FindMyOrganizationsQuery = Schema.TaggedStruct("FindMyOrganizationsQuery", {
  userId: UserId,
});
export type FindMyOrganizationsQuery = typeof FindMyOrganizationsQuery.Type;

export const findMyOrganizationsQuerySpanAttributes: SpanAttributesExtractor<
  FindMyOrganizationsQuery
> = (query) => ({
  "query.userId": query.userId,
});

export type FindMyOrganizationsView = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
  // Whether the caller holds the `admin` OrganizationRole in this org.
  // Drives the frontend's admin-only surfaces (Billing / Invite tabs,
  // member management) without a separate role probe.
  readonly isAdmin: boolean;
};

export type FindMyOrganizationsResult = {
  readonly organizations: ReadonlyArray<FindMyOrganizationsView>;
};
