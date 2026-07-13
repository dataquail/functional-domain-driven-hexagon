import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { type SubscriptionRoot } from "./subscription.root.js";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The field-name strings live here and in the mapper's
// column map; `Spec.eq` types them against SubscriptionRoot so a typo is a
// compile error.
const forOrganization = (organizationId: OrganizationId): Specification<SubscriptionRoot> =>
  Spec.eq<SubscriptionRoot, "organizationId">("organizationId", organizationId);

const withStripeSubscriptionId = (stripeSubscriptionId: string): Specification<SubscriptionRoot> =>
  Spec.eq<SubscriptionRoot, "stripeSubscriptionId">("stripeSubscriptionId", stripeSubscriptionId);

export const SubscriptionSpecifications = { forOrganization, withStripeSubscriptionId } as const;
