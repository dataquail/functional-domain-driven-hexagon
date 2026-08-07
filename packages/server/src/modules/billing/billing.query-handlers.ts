import { Query } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import { findSubscriptionByOrganizationHandler } from "@/modules/billing/queries/find-subscription-by-organization.handler.js";
import { FindSubscriptionByOrganizationQuery } from "@/modules/billing/queries/find-subscription-by-organization.query.js";

export const billingQueryGroup = Query.group(FindSubscriptionByOrganizationQuery);

const BillingQueryHandlersLive = Query.handlersOf(billingQueryGroup, {
  FindSubscriptionByOrganizationQuery: (payload) => findSubscriptionByOrganizationHandler(payload),
});

const billingQuerySpanAttributes: Query.SpanAttributes<typeof billingQueryGroup> = {
  FindSubscriptionByOrganizationQuery: (payload) => ({
    "organization.id": payload.organizationId,
  }),
};

export class BillingQueries extends Context.Service<
  BillingQueries,
  Query.Dispatcher<typeof billingQueryGroup>
>()("@org/server/billing/BillingQueries") {}

export const BillingQueriesLive = Layer.effect(
  BillingQueries,
  Query.dispatcher(billingQueryGroup, { spanAttributes: billingQuerySpanAttributes }),
).pipe(Layer.provide(BillingQueryHandlersLive));
