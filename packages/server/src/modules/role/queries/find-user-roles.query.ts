import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Read-side projection of a user's platform roles. Returns an empty
// array if the user has none — absence isn't NotFound. Role names are
// projected as bare strings; the read path trusts the DB (the write
// side is the sole place that validates against the recognized set),
// and the consuming `RoleService` narrows to the roles it knows.
export const FindUserRolesQuery = Schema.TaggedStruct("FindUserRolesQuery", {
  userId: UserId,
});
export type FindUserRolesQuery = typeof FindUserRolesQuery.Type;

export type FindUserRolesResult = {
  readonly userId: UserId;
  readonly roles: ReadonlyArray<string>;
};

export const findUserRolesQuerySpanAttributes: SpanAttributesExtractor<FindUserRolesQuery> = (
  query,
) => ({ "query.userId": query.userId });
