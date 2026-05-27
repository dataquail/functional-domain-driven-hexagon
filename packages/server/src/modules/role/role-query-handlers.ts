import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { RolesRepositoryLive } from "@/modules/role/infrastructure/roles-repository-live.js";
import { findUserRoles } from "@/modules/role/queries/find-user-roles.js";
import {
  type FindUserRolesQuery,
  findUserRolesQuerySpanAttributes,
  type FindUserRolesResult,
} from "@/modules/role/queries/find-user-roles-query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindUserRolesBusOutput = Effect.Effect<
  FindUserRolesResult,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindUserRolesQuery: {
      readonly query: FindUserRolesQuery;
      readonly output: FindUserRolesBusOutput;
    };
  }
}

export const roleQueryHandlers = queryHandlers({
  FindUserRolesQuery: {
    handle: (q): FindUserRolesBusOutput =>
      findUserRoles(q).pipe(Effect.provide(RolesRepositoryLive)),
    spanAttributes: findUserRolesQuerySpanAttributes,
  },
});
