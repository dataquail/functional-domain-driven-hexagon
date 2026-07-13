import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type MembershipRoot } from "./membership.root.js";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The composite identity is expressed by AND-composing the
// two halves at the call site: `Spec.and(forUser(u), forOrganization(o))`.
const forUser = (userId: UserId): Specification<MembershipRoot> =>
  Spec.eq<MembershipRoot, "userId">("userId", userId);
const forOrganization = (organizationId: OrganizationId): Specification<MembershipRoot> =>
  Spec.eq<MembershipRoot, "organizationId">("organizationId", organizationId);

export const MembershipSpecifications = { forUser, forOrganization } as const;
