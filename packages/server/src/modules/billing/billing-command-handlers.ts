import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { cancelSubscription } from "@/modules/billing/commands/cancel-subscription.js";
import {
  type CancelSubscriptionCommand,
  cancelSubscriptionCommandSpanAttributes,
} from "@/modules/billing/commands/cancel-subscription-command.js";
import { ingestStripeWebhook } from "@/modules/billing/commands/ingest-stripe-webhook.js";
import {
  type IngestStripeWebhookCommand,
  ingestStripeWebhookCommandSpanAttributes,
} from "@/modules/billing/commands/ingest-stripe-webhook-command.js";
import { startSubscription } from "@/modules/billing/commands/start-subscription.js";
import {
  type StartSubscriptionCommand,
  startSubscriptionCommandSpanAttributes,
} from "@/modules/billing/commands/start-subscription-command.js";
import { type BillingGateway } from "@/modules/billing/domain/ports/billing-gateway.js";
import { type Subscription } from "@/modules/billing/domain/subscription.aggregate.js";
import {
  type BillingGatewayUnavailable,
  type SubscriptionAlreadyExistsForOrganization,
  type SubscriptionNotFound,
} from "@/modules/billing/domain/subscription-errors.js";
import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/subscription-repository-live.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/webhook-event-repository-live.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { commandHandlers } from "@/platform/ddd/ports/command-bus.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Bus-visible output types: the raw handlers in `commands/` carry
// `SubscriptionRepository` in R; the wraps below discharge that via
// `SubscriptionRepositoryLive`. `BillingGateway` stays in R because
// the composition root chooses Live (Stripe) vs Fake at runtime —
// repos are owned-and-static; the gateway is the integration seam.
// `EnvVars` stays in R because `EnvVars.Default` is provided at the
// server boot level.

type StartSubscriptionBusOutput = Effect.Effect<
  Subscription,
  SubscriptionAlreadyExistsForOrganization | BillingGatewayUnavailable | PersistenceUnavailable,
  BillingGateway | DomainEventBus | UnitOfWork | Database.Database
>;

type CancelSubscriptionBusOutput = Effect.Effect<
  Subscription,
  SubscriptionNotFound | BillingGatewayUnavailable | PersistenceUnavailable,
  BillingGateway | DomainEventBus | UnitOfWork | Database.Database
>;

type IngestStripeWebhookBusOutput = Effect.Effect<
  void,
  PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  interface CommandRegistry {
    StartSubscriptionCommand: {
      readonly command: StartSubscriptionCommand;
      readonly output: StartSubscriptionBusOutput;
    };
    CancelSubscriptionCommand: {
      readonly command: CancelSubscriptionCommand;
      readonly output: CancelSubscriptionBusOutput;
    };
    IngestStripeWebhookCommand: {
      readonly command: IngestStripeWebhookCommand;
      readonly output: IngestStripeWebhookBusOutput;
    };
  }
}

export const billingCommandHandlers = commandHandlers({
  StartSubscriptionCommand: {
    handle: (cmd): StartSubscriptionBusOutput =>
      startSubscription(cmd).pipe(Effect.provide(SubscriptionRepositoryLive)),
    spanAttributes: startSubscriptionCommandSpanAttributes,
  },
  CancelSubscriptionCommand: {
    handle: (cmd): CancelSubscriptionBusOutput =>
      cancelSubscription(cmd).pipe(Effect.provide(SubscriptionRepositoryLive)),
    spanAttributes: cancelSubscriptionCommandSpanAttributes,
  },
  IngestStripeWebhookCommand: {
    handle: (cmd): IngestStripeWebhookBusOutput =>
      ingestStripeWebhook(cmd).pipe(Effect.provide(WebhookEventRepositoryLive)),
    spanAttributes: ingestStripeWebhookCommandSpanAttributes,
  },
});
