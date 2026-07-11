import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Detailed membership view returned to the member-management surface
// (org-admin + super-admin). The handler reads its own schema directly
// (membership rows + admin role rows) and enriches each row with the
// user's email through the `UsersLookup` ACL — ADR-0020 disallows the
// cross-schema JOIN that would otherwise fetch it. The endpoint just
// dispatches through the QueryBus and maps the result to the contract.
export const FindOrganizationMembershipsQuery = Schema.TaggedStruct(
  "FindOrganizationMembershipsQuery",
  { organizationId: OrganizationId },
);
export type FindOrganizationMembershipsQuery = typeof FindOrganizationMembershipsQuery.Type;

export const findOrganizationMembershipsQuerySpanAttributes: SpanAttributesExtractor<
  FindOrganizationMembershipsQuery
> = (query) => ({ "organization.id": query.organizationId });

export type OrganizationMemberView = {
  readonly userId: UserId;
  readonly email: string;
  readonly joinedAt: DateTime.Utc;
  readonly isAdmin: boolean;
};
