import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import {
  type CancelSubscriptionCommand,
  cancelSubscriptionCommandSpanAttributes,
} from "@/modules/billing/commands/cancel-subscription.command.js";
import { cancelSubscription } from "@/modules/billing/commands/cancel-subscription.handler.js";
import {
  type IngestStripeWebhookCommand,
  ingestStripeWebhookCommandSpanAttributes,
} from "@/modules/billing/commands/ingest-stripe-webhook.command.js";
import { ingestStripeWebhook } from "@/modules/billing/commands/ingest-stripe-webhook.handler.js";
import {
  type StartSubscriptionCommand,
  startSubscriptionCommandSpanAttributes,
} from "@/modules/billing/commands/start-subscription.command.js";
import { startSubscription } from "@/modules/billing/commands/start-subscription.handler.js";
import { type BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import {
  type BillingGatewayUnavailable,
  type InvalidWebhookSignature,
  type SubscriptionAlreadyExistsForOrganization,
  type SubscriptionNotFound,
} from "@/modules/billing/domain/subscription.errors.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription.root.js";
import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/repositories/subscription.repository-live.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/repositories/webhook-event.repository-live.js";
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
  SubscriptionRoot,
  SubscriptionAlreadyExistsForOrganization | BillingGatewayUnavailable | PersistenceUnavailable,
  BillingGateway | DomainEventBus | UnitOfWork | Database.Database
>;

type CancelSubscriptionBusOutput = Effect.Effect<
  SubscriptionRoot,
  SubscriptionNotFound | BillingGatewayUnavailable | PersistenceUnavailable,
  BillingGateway | DomainEventBus | UnitOfWork | Database.Database
>;

type IngestStripeWebhookBusOutput = Effect.Effect<
  void,
  InvalidWebhookSignature | PersistenceUnavailable,
  BillingGateway | DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires `interface`
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
