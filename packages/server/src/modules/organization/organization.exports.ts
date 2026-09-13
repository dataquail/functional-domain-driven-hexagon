import { Query } from "@effect-server-utils/cqrs";

import { OrganizationCreated } from "./domain/organization/organization.events.js";
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

// The domain events a peer may subscribe to, collected so the grant is one
// name: a module that adds an event to its own domain does not widen this by
// doing so, and a peer's import line says which context it is listening to.
export const organizationAccessDomainEvents = { OrganizationCreated } as const;
