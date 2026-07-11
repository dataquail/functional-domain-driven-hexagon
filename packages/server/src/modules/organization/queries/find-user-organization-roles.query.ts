import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Read-side projection of a user's roles within one organization.
// Returns an empty roles array if the user holds none — absence isn't
// NotFound. Role names are projected as bare strings; the read path
// trusts the DB (the write side is the sole validator) and the
// consuming policy service narrows to the roles it recognizes.
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
  readonly roles: ReadonlyArray<string>;
};

export const findUserOrganizationRolesQuerySpanAttributes: SpanAttributesExtractor<
  FindUserOrganizationRolesQuery
> = (query) => ({
  "query.userId": query.userId,
  "query.organizationId": query.organizationId,
});
