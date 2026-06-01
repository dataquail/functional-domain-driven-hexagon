import { makeIsOrgMember } from "@/platform/auth/policies/is-org-member.js";

import { type TodoOrgContext } from "./todo-resource-resolvers.js";

// "Is this caller a member of the todo's org?" — shared by both todo
// policy resources (`todoCollection.read` and `todo.update`/`delete`),
// which both resolve to `{ organizationId }`. The membership lookup
// lives in the shared `makeIsOrgMember` factory (platform), over the
// `MembershipService` ACL; this module supplies only the resource→orgId
// extractor. Same pattern as the organization module's `IsMember`.
export const IsTodoOrgMember = makeIsOrgMember(
  (resource: TodoOrgContext) => resource.organizationId,
);
