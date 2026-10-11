import { Query } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";

export const FindUserIdByEmailQuery = Query.make("FindUserIdByEmailQuery", {
  payload: { email: Schema.String },
  success: Schema.NullOr(UserId),
  failure: PersistenceUnavailable,
});
export type FindUserIdByEmailPayload = Query.Payload<typeof FindUserIdByEmailQuery>;
