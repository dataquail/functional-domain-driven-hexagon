import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { Spec, type Specification } from "@/globals/application/ddd/specification.ts";

import { type SubscriptionRoot } from "./subscription.root.ts";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The field-name strings live here and in the mapper's
// column map; `Spec.eq` types them against SubscriptionRoot so a typo is a
// compile error.
const forOrganization = (organizationId: OrganizationId): Specification<SubscriptionRoot> =>
  Spec.eq<SubscriptionRoot, "organizationId">("organizationId", organizationId);

const withStripeSubscriptionId = (stripeSubscriptionId: string): Specification<SubscriptionRoot> =>
  Spec.eq<SubscriptionRoot, "stripeSubscriptionId">("stripeSubscriptionId", stripeSubscriptionId);

export const SubscriptionSpecifications = { forOrganization, withStripeSubscriptionId } as const;
