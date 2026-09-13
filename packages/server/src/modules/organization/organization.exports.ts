import { Query } from "@effect-server-utils/cqrs";

import { OrganizationModule } from "./organization.module.js";
import { organizationQueryGroup } from "./organization.query-handlers.js";

// The peer surface: two of this module's seven queries. Todos and billing ask
// about membership and organization roles from their policy checks, through
// their own ACL ports; the other five are not theirs to reach, and a query added
// to the group later will not be either.
export const organizationAccessQueries = Query.subsetOf(
  organizationQueryGroup,
  "FindMembershipQuery",
  "FindUserOrganizationRolesQuery",
);

export { OrganizationCreated } from "./domain/organization/organization.events.js";

// The layer a peer provides in order to import this module. The module value
// itself is not published here: its http slots are wiring, not a peer's business.
export const organizationLayer = OrganizationModule.layer;
