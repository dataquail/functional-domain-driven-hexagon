import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";

import { findUsers } from "@/modules/user/queries/find-users.handler.js";
import {
  type FindUsersQuery,
  findUsersQuerySpanAttributes,
  type FindUsersResult,
  type FindUsersUserView,
} from "@/modules/user/queries/find-users.query.js";
import { findUsersByIds } from "@/modules/user/queries/find-users-by-ids.handler.js";
import {
  type FindUsersByIdsQuery,
  findUsersByIdsQuerySpanAttributes,
} from "@/modules/user/queries/find-users-by-ids.query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindUsersOutput = Effect.Effect<FindUsersResult, PersistenceUnavailable, Database.Database>;

type FindUsersByIdsOutput = Effect.Effect<
  ReadonlyArray<FindUsersUserView>,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindUsersQuery: {
      readonly query: FindUsersQuery;
      readonly output: FindUsersOutput;
    };
    FindUsersByIdsQuery: {
      readonly query: FindUsersByIdsQuery;
      readonly output: FindUsersByIdsOutput;
    };
  }
}

// `FindUsersQuery` reads SQL directly (no UserRepository in R) so the
// handler doesn't need wrapping. Lives at module root for symmetry with
// `user-command-handlers.ts`.
export const userQueryHandlers = queryHandlers({
  FindUsersQuery: { handle: findUsers, spanAttributes: findUsersQuerySpanAttributes },
  FindUsersByIdsQuery: {
    handle: findUsersByIds,
    spanAttributes: findUsersByIdsQuerySpanAttributes,
  },
});
