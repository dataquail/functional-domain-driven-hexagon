import { Query } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const CurrentUserView = Schema.Struct({
  userId: UserId,
  isSuperAdmin: Schema.Boolean,
});
export type CurrentUserView = typeof CurrentUserView.Type;

// Backs `/auth/me`: the caller's identity plus the one authorization fact the
// client routes on. `isSuperAdmin` is the role module's data, reached through
// this module's `PlatformRoles` port — going through the bus is what keeps the
// endpoint free of cross-module vocabulary.
export const FindCurrentUserQuery = Query.make("FindCurrentUserQuery", {
  payload: { userId: UserId },
  success: CurrentUserView,
  failure: PersistenceUnavailable,
});
export type FindCurrentUserPayload = Query.Payload<typeof FindCurrentUserQuery>;
