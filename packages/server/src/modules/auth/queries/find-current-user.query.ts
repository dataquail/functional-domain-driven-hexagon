import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Backs `/auth/me`: the caller's identity plus the one authorization fact the
// client routes on. `isSuperAdmin` is the role module's data, reached through
// this module's `PlatformRoles` port — going through the bus is what keeps the
// endpoint free of cross-module vocabulary.
export const FindCurrentUserQuery = Schema.TaggedStruct("FindCurrentUserQuery", {
  userId: UserId,
});
export type FindCurrentUserQuery = typeof FindCurrentUserQuery.Type;

export type CurrentUserView = {
  readonly userId: UserId;
  readonly isSuperAdmin: boolean;
};

export const findCurrentUserQuerySpanAttributes: SpanAttributesExtractor<FindCurrentUserQuery> = (
  q,
) => ({ "user.id": q.userId });
