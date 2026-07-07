import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/repositories/subscription.repository-live.js";
import { findSubscriptionByOrganization } from "@/modules/billing/queries/find-subscription-by-organization.handler.js";
import {
  type FindSubscriptionByOrganizationQuery,
  findSubscriptionByOrganizationQuerySpanAttributes,
  type FindSubscriptionByOrganizationResult,
} from "@/modules/billing/queries/find-subscription-by-organization.query.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

type FindSubscriptionByOrganizationBusOutput = Effect.Effect<
  FindSubscriptionByOrganizationResult,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  interface QueryRegistry {
    FindSubscriptionByOrganizationQuery: {
      readonly query: FindSubscriptionByOrganizationQuery;
      readonly output: FindSubscriptionByOrganizationBusOutput;
    };
  }
}

export const billingQueryHandlers = queryHandlers({
  FindSubscriptionByOrganizationQuery: {
    handle: (q): FindSubscriptionByOrganizationBusOutput =>
      findSubscriptionByOrganization(q).pipe(Effect.provide(SubscriptionRepositoryLive)),
    spanAttributes: findSubscriptionByOrganizationQuerySpanAttributes,
  },
});
