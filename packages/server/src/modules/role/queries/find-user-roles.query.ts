import * as Schema from "effect/Schema";

import { type RoleValueObject } from "@/modules/role/domain/role.value-object.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Read-side projection of a user's platform roles. Returns an empty
// array if the user has none — absence isn't NotFound. Other modules'
// policies don't depend on this query directly; the platform-layer
// `RoleService` (`platform/role-service-live.ts`) wraps it and maps to
// a generalized shape.
export const FindUserRolesQuery = Schema.TaggedStruct("FindUserRolesQuery", {
  userId: UserId,
});
export type FindUserRolesQuery = typeof FindUserRolesQuery.Type;

export type FindUserRolesResult = {
  readonly userId: UserId;
  readonly roles: ReadonlyArray<RoleValueObject>;
};

export const findUserRolesQuerySpanAttributes: SpanAttributesExtractor<FindUserRolesQuery> = (
  query,
) => ({ "query.userId": query.userId });
