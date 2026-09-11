import { type Query } from "@effect-server-utils/cqrs";
import { Module } from "@org/module";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationQueries, type organizationQueryGroup } from "./organization.query-handlers.js";

// The peer surface: the individual messages other modules may dispatch, named
// one by one. Two of this module's seven queries — handing out
// `OrganizationQueries` would have granted all seven, and any query added to the
// group later.
export class OrganizationExports extends Context.Service<
  OrganizationExports,
  Pick<
    Query.Dispatcher<typeof organizationQueryGroup>,
    "FindMembershipQuery" | "FindUserOrganizationRolesQuery"
  >
>()("@org/server/organization/OrganizationExports") {}

export const OrganizationExportsLive = Layer.effect(
  OrganizationExports,
  Effect.map(OrganizationQueries, (queries) =>
    OrganizationExports.of({
      FindMembershipQuery: queries.FindMembershipQuery,
      FindUserOrganizationRolesQuery: queries.FindUserOrganizationRolesQuery,
    }),
  ),
);

// Todos and billing ask about membership and organization roles from their
// policy checks, through their own ACL ports.
export const organizationExports = Module.exports(OrganizationExports);

export { OrganizationCreated } from "./domain/organization/organization.events.js";
