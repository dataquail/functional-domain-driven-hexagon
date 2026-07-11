import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";

import { findUserRoles } from "@/modules/role/queries/find-user-roles.handler.js";
import {
  type FindUserRolesQuery,
  findUserRolesQuerySpanAttributes,
  type FindUserRolesResult,
} from "@/modules/role/queries/find-user-roles.query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindUserRolesOutput = Effect.Effect<
  FindUserRolesResult,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindUserRolesQuery: {
      readonly query: FindUserRolesQuery;
      readonly output: FindUserRolesOutput;
    };
  }
}

export const roleQueryHandlers = queryHandlers({
  FindUserRolesQuery: {
    handle: findUserRoles,
    spanAttributes: findUserRolesQuerySpanAttributes,
  },
});
