import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/organization-roles-repository-live.js";
import { findAllOrganizations } from "@/modules/organization/queries/find-all-organizations.js";
import { findAllOrganizationsQuerySpanAttributes } from "@/modules/organization/queries/find-all-organizations-query.js";
import { findUserOrganizationRoles } from "@/modules/organization/queries/find-user-organization-roles.js";
import {
  type FindUserOrganizationRolesQuery,
  findUserOrganizationRolesQuerySpanAttributes,
  type FindUserOrganizationRolesResult,
} from "@/modules/organization/queries/find-user-organization-roles-query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/query-bus.js";

type FindUserOrganizationRolesBusOutput = Effect.Effect<
  FindUserOrganizationRolesResult,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/query-bus.js" {
  interface QueryRegistry {
    FindUserOrganizationRolesQuery: {
      readonly query: FindUserOrganizationRolesQuery;
      readonly output: FindUserOrganizationRolesBusOutput;
    };
  }
}

// `FindAllOrganizationsQuery` reads SQL directly (no repository in R)
// so the handler doesn't need wrapping. `FindUserOrganizationRolesQuery`
// goes through the `OrganizationRolesRepository` and is wrapped with
// `OrganizationRolesRepositoryLive` to discharge that dep before the
// bus dispatch.
export const organizationQueryHandlers = queryHandlers({
  FindAllOrganizationsQuery: {
    handle: findAllOrganizations,
    spanAttributes: findAllOrganizationsQuerySpanAttributes,
  },
  FindUserOrganizationRolesQuery: {
    handle: (q): FindUserOrganizationRolesBusOutput =>
      findUserOrganizationRoles(q).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
    spanAttributes: findUserOrganizationRolesQuerySpanAttributes,
  },
});
