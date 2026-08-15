import { type ResourceCheck } from "@org/authz";

import { type OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";

import { type TodoOrgContext } from "./todo.resource-resolvers.js";

// "Is this caller a member of the todo's org?" — shared by both todo policy
// resources (`todoCollection` and `todo`), which both resolve to a
// `{ organizationId }` context.
//
// The port arrives as an argument rather than through the Effect environment so
// the returned check is `R = never`. That is what lets the registry hold
// fully-closed checks, and what lets a policy test provide this module's own
// fake and nothing else.
export const makeIsTodoOrgMember =
  (organizations: OrganizationAccess["Service"]): ResourceCheck<TodoOrgContext> =>
  (caller, resource) =>
    organizations.isMember(caller.userId, resource.organizationId);
