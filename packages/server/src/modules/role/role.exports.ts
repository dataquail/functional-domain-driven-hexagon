import { Query } from "@effect-server-utils/cqrs";

import { roleQueryGroup } from "./role.query-handlers.js";

// The peer surface: the individual messages another module may dispatch, and
// nothing beside them. A dispatcher built over this group demands only these
// tags' registrations, so a peer reaching for a query missing from the list
// would need a registration this module never published.
//
// Adding a query to `roleQueryGroup` cannot widen it — the list here is the
// whole grant.
export const roleAccessQueries = Query.subsetOf(roleQueryGroup, "FindUserRolesQuery");
