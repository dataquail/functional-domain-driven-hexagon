import { PersistenceUnavailable, Query } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const SubscriptionView = Schema.Struct({
  id: SubscriptionId,
  organizationId: OrganizationId,
  status: Schema.String,
  currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
});
export type SubscriptionView = typeof SubscriptionView.Type;

// `null` for "no subscription", not `Option`: every other absent-read model here is
// nullable, and a null is representable on a wire where an `Option` needs a codec.
export type FindSubscriptionByOrganizationResult = SubscriptionView | null;

export const FindSubscriptionByOrganizationQuery = Query.make(
  "FindSubscriptionByOrganizationQuery",
  {
    payload: { organizationId: OrganizationId },
    success: Schema.NullOr(SubscriptionView),
    failure: PersistenceUnavailable,
  },
);
export type FindSubscriptionByOrganizationPayload = Query.Payload<
  typeof FindSubscriptionByOrganizationQuery
>;
