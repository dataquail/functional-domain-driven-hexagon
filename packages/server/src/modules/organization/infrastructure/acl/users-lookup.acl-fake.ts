import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type UserLookupView,
  UsersLookup,
} from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import { type UserId } from "@/platform/ids/user-id.js";

// In-memory `UsersLookup` for use-case unit tests that need to enrich
// memberships with user emails without standing up the user-module
// query bus + DB. Pass the seed mapping at construction time.
export const makeUsersLookupFake = (byId: ReadonlyMap<UserId, UserLookupView>) =>
  Layer.succeed(
    UsersLookup,
    UsersLookup.of({
      findByIds: (ids) =>
        Effect.succeed(
          ids.flatMap((id) => {
            const view = byId.get(id);
            return view === undefined ? [] : [view];
          }),
        ),
    }),
  );
