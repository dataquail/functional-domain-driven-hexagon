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
import {
  type SyncSubscriptionCommand,
  syncSubscriptionCommandSpanAttributes,
} from "@/modules/billing/commands/sync-subscription.command.js";
import { syncSubscription } from "@/modules/billing/commands/sync-subscription.handler.js";
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
// `EnvVars` stays in R because `EnvVars.layer` is provided at the
// server boot level.

type StartSubscriptionOutput = Effect.Effect<
  SubscriptionRoot,
  SubscriptionAlreadyExistsForOrganization | BillingGatewayUnavailable | PersistenceUnavailable,
  BillingGateway | DomainEventBus | UnitOfWork | Database.Database
>;

type CancelSubscriptionOutput = Effect.Effect<
  SubscriptionRoot,
  SubscriptionNotFound | BillingGatewayUnavailable | PersistenceUnavailable,
  BillingGateway | DomainEventBus | UnitOfWork | Database.Database
>;

type IngestStripeWebhookOutput = Effect.Effect<
  void,
  InvalidWebhookSignature | PersistenceUnavailable,
  BillingGateway | DomainEventBus | UnitOfWork | Database.Database
>;

type SyncSubscriptionOutput = Effect.Effect<
  void,
  PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  interface CommandRegistry {
    StartSubscriptionCommand: {
      readonly command: StartSubscriptionCommand;
      readonly output: StartSubscriptionOutput;
    };
    CancelSubscriptionCommand: {
      readonly command: CancelSubscriptionCommand;
      readonly output: CancelSubscriptionOutput;
    };
    IngestStripeWebhookCommand: {
      readonly command: IngestStripeWebhookCommand;
      readonly output: IngestStripeWebhookOutput;
    };
    SyncSubscriptionCommand: {
      readonly command: SyncSubscriptionCommand;
      readonly output: SyncSubscriptionOutput;
    };
  }
}

export const billingCommandHandlers = commandHandlers({
  StartSubscriptionCommand: {
    handle: (cmd): StartSubscriptionOutput =>
      startSubscription(cmd).pipe(Effect.provide(SubscriptionRepositoryLive)),
    spanAttributes: startSubscriptionCommandSpanAttributes,
  },
  CancelSubscriptionCommand: {
    handle: (cmd): CancelSubscriptionOutput =>
      cancelSubscription(cmd).pipe(Effect.provide(SubscriptionRepositoryLive)),
    spanAttributes: cancelSubscriptionCommandSpanAttributes,
  },
  IngestStripeWebhookCommand: {
    handle: (cmd): IngestStripeWebhookOutput =>
      ingestStripeWebhook(cmd).pipe(Effect.provide(WebhookEventRepositoryLive)),
    spanAttributes: ingestStripeWebhookCommandSpanAttributes,
  },
  SyncSubscriptionCommand: {
    handle: (cmd): SyncSubscriptionOutput =>
      syncSubscription(cmd).pipe(Effect.provide(SubscriptionRepositoryLive)),
    spanAttributes: syncSubscriptionCommandSpanAttributes,
  },
});
