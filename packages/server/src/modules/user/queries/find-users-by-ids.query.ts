import { PersistenceUnavailable, Query } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { FindUsersUserView } from "@/modules/user/queries/find-users.query.js";
import { UserId } from "@/platform/ids/user-id.js";

// Batched lookup by id list. Used by the SA's "members of an org"
// endpoint to enrich the org-module's membership rows with email
// without a cross-schema JOIN. Returns only the users present in the
// `ids` argument — missing ids are silently omitted.
export const FindUsersByIdsQuery = Query.make("FindUsersByIdsQuery", {
  payload: { ids: Schema.Array(UserId) },
  success: Schema.Array(FindUsersUserView),
  failure: PersistenceUnavailable,
});
export type FindUsersByIdsPayload = Query.Payload<typeof FindUsersByIdsQuery>;
