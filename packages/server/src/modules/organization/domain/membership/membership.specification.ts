import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { type UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { Spec, type Specification } from "@/globals/application/ddd/specification.ts";

import { type MembershipRoot } from "./membership.root.ts";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The composite identity is expressed by AND-composing the
// two halves at the call site: `Spec.and(forUser(u), forOrganization(o))`.
const forUser = (userId: UserId): Specification<MembershipRoot> =>
  Spec.eq<MembershipRoot, "userId">("userId", userId);

const forOrganization = (organizationId: OrganizationId): Specification<MembershipRoot> =>
  Spec.eq<MembershipRoot, "organizationId">("organizationId", organizationId);

export const MembershipSpecifications = { forUser, forOrganization } as const;
