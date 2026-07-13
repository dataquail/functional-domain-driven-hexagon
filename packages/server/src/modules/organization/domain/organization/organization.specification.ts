import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

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
