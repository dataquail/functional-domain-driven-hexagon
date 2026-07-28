import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UsersLookup } from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import { UserQueries } from "@/modules/user/index.js";

// ADR-0022 outbound adapter. The one place in the org module where the user module's
// barrel is imported — every other folder (commands, queries, interface/http) goes
// through `UsersLookup`. It resolves that module's own dispatch surface rather than the
// app-wide bus, so a module whose handlers need this port does not end up depending on
// the bus that routes those handlers.
export const UsersLookupLive = Layer.effect(
  UsersLookup,
  Effect.gen(function* () {
    const userQueries = yield* UserQueries;
    return UsersLookup.of({
      findByIds: (ids) =>
        userQueries
          .FindUsersByIdsQuery({ ids })
          .pipe(Effect.map((users) => users.map((u) => ({ userId: u.id, email: u.email })))),
    });
  }),
);
