import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Detailed membership view returned to the member-management surface
// (org-admin + super-admin). The handler orchestrates three reads —
// `MembershipRepository` for the membership rows, the `UsersLookup`
// outbound port for each user's email (ADR-0021 disallows cross-schema
// SQL), and `OrganizationRolesRepository` for each member's `isAdmin`
// flag. The endpoint just dispatches through the QueryBus and maps the
// result to the contract; the cross-module concerns stay inside the
// use case (matching the "outbound ports are private to use cases"
// rule).
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
