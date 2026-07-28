import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Read-side projection of a user's platform roles. Returns an empty
// array if the user has none — absence isn't NotFound. Role names are
// projected as bare strings; the read path trusts the DB (the write
// side is the sole place that validates against the recognized set),
// and each consuming module's ACL adapter narrows to the roles it knows.
// The projection as a schema rather than a bare type alias: four other modules'
// ACL adapters read it, so the shape it promises is a published contract.
export const UserRolesView = Schema.Struct({
  userId: UserId,
  roles: Schema.Array(Schema.String),
});
export type FindUserRolesResult = typeof UserRolesView.Type;

export const FindUserRolesQuery = Query.make("FindUserRolesQuery", {
  payload: { userId: UserId },
  success: UserRolesView,
  failure: PersistenceUnavailable,
});
export type FindUserRolesPayload = Query.Payload<typeof FindUserRolesQuery>;
