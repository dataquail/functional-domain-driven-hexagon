import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { Spec, type Specification } from "@/globals/application/ddd/specification.js";

import { type OrganizationRoot } from "./organization.root.js";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). `isDeleted` doubles as the soft-delete guard the root-ops
// call as a predicate; `notDeleted` is its complement, composed into the
// active-only read; `withId` is the identity lookup.
const withId = (id: OrganizationId): Specification<OrganizationRoot> =>
  Spec.eq<OrganizationRoot, "id">("id", id);

const isDeleted = Spec.isNotNull<OrganizationRoot>("deletedAt");
const notDeleted = Spec.isNull<OrganizationRoot>("deletedAt");

export const OrganizationSpecifications = { withId, isDeleted, notDeleted } as const;
