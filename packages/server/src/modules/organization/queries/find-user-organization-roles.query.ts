import * as Schema from "effect/Schema";

import { type OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Read-side projection of a user's roles within one organization.
// Returns an empty roles array if the user holds none — absence isn't
// NotFound. Other modules' policies don't depend on this query
// directly; the platform-layer `OrganizationRoleService` (`platform/
// ddd/organization-role-service.ts`) wraps it and maps to a generalized
// shape.
export const FindUserOrganizationRolesQuery = Schema.TaggedStruct(
  "FindUserOrganizationRolesQuery",
  {
    userId: UserId,
    organizationId: OrganizationId,
  },
);
export type FindUserOrganizationRolesQuery = typeof FindUserOrganizationRolesQuery.Type;

export type FindUserOrganizationRolesResult = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly roles: ReadonlyArray<OrganizationRoleValueObject>;
};

export const findUserOrganizationRolesQuerySpanAttributes: SpanAttributesExtractor<
  FindUserOrganizationRolesQuery
> = (query) => ({
  "query.userId": query.userId,
  "query.organizationId": query.organizationId,
});
