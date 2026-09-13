import { Query } from "@effect-server-utils/cqrs";

import { RoleModule } from "./role.module.js";
import { roleQueryGroup } from "./role.query-handlers.js";

// The peer surface: the individual messages another module may dispatch, and
// nothing beside them. A dispatcher built over this group demands only these
// tags' registrations, so a peer reaching for a query missing from the list
// would need a registration this module never published.
//
// Adding a query to `roleQueryGroup` cannot widen it — the list here is the
// whole grant.
export const rolePeerQueries = Query.subsetOf(roleQueryGroup, "FindUserRolesQuery");

// The layer a peer provides in order to import this module. The module value
// itself is not published here: its http slots are wiring, not a peer's business.
export const roleLayer = RoleModule.layer;
