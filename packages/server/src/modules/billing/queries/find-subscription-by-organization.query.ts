import { Query } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id";

export const SubscriptionView = Schema.Struct({
  id: SubscriptionId,
  organizationId: OrganizationId,
  status: Schema.String,
  currentPeriodEnd: Schema.OptionFromNullOr(Schema.DateTimeUtc),
});

export type SubscriptionView = typeof SubscriptionView.Type;

export type FindSubscriptionByOrganizationResult = Option.Option<SubscriptionView>;

export const FindSubscriptionByOrganizationQuery = Query.make(
  "FindSubscriptionByOrganizationQuery",
  {
    payload: { organizationId: OrganizationId },
    success: Schema.OptionFromNullOr(SubscriptionView),
    failure: PersistenceUnavailable,
  },
);

export type FindSubscriptionByOrganizationPayload = Query.Payload<
  typeof FindSubscriptionByOrganizationQuery
>;
