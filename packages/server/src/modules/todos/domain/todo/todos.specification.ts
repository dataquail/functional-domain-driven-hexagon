import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { Spec, type Specification } from "@/globals/application/ddd/specification.js";

import { type TodoId } from "./todo.id.js";
import { type TodoRoot } from "./todo.root.js";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The field-name strings live here and in the mapper's
// column map; `Spec.eq` types them against TodoRoot so a typo is a compile
// error. Every read is org-scoped, so an id lookup pins the org too:
// `Spec.and(withId(id), forOrganization(orgId))`.
const withId = (id: TodoId): Specification<TodoRoot> => Spec.eq<TodoRoot, "id">("id", id);

const forOrganization = (organizationId: OrganizationId): Specification<TodoRoot> =>
  Spec.eq<TodoRoot, "organizationId">("organizationId", organizationId);

export const TodoSpecifications = { withId, forOrganization } as const;
