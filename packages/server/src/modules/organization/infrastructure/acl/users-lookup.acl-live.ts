import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UsersLookup } from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import { FindUsersByIdsQuery } from "@/modules/user/index.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";

// ADR-0022 outbound adapter. The one place in the org module where
// the user module's barrel is imported — every other folder
// (commands, queries, interface/http) goes through `UsersLookup`.
// Dispatches the user-module's `FindUsersByIdsQuery` through the
// shared `QueryBus` so the cross-module call participates in the
// usual span/trace plumbing.
//
// `Database` is captured at construction time and re-provided to the
// bus-dispatched effect so the port's method surface stays
// `R = never` (the user-module's `findUsersByIds` handler reads SQL
// directly and pulls `Database` through `QueryBus.execute`'s typed
// return).
export const UsersLookupLive = Layer.effect(
  UsersLookup,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    const db = yield* Database.Database;
    return UsersLookup.of({
      findByIds: (ids) =>
        queryBus.execute(FindUsersByIdsQuery.make({ ids })).pipe(
          Effect.provideService(Database.Database, db),
          Effect.map((users) => users.map((u) => ({ userId: u.id, email: u.email }))),
        ),
    });
  }),
);
