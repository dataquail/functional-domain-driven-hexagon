import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type EnvVars } from "@/common/env-vars.js";
import { CancelSubscription } from "@/modules/billing/commands/cancel-subscription.command.js";
import { cancelSubscription } from "@/modules/billing/commands/cancel-subscription.handler.js";
import { IngestStripeWebhook } from "@/modules/billing/commands/ingest-stripe-webhook.command.js";
import { ingestStripeWebhook } from "@/modules/billing/commands/ingest-stripe-webhook.handler.js";
import { StartSubscription } from "@/modules/billing/commands/start-subscription.command.js";
import { startSubscription } from "@/modules/billing/commands/start-subscription.handler.js";
import { SyncSubscription } from "@/modules/billing/commands/sync-subscription.command.js";
import { syncSubscription } from "@/modules/billing/commands/sync-subscription.handler.js";
import { type BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { BillingGatewayFake } from "@/modules/billing/infrastructure/clients/billing-gateway.client-fake.js";
import { BillingGatewayLive } from "@/modules/billing/infrastructure/clients/billing-gateway.client-live.js";
import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/repositories/subscription.repository-live.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/repositories/webhook-event.repository-live.js";

// Repositories are owned-and-static, so each entry below discharges its own. The gateway
// is the integration seam and stays in the handler map's requirements: this module ships
// two named Lives so the Stripe-vs-fake swap is a choice between them rather than a port
// Tag threaded through the composition root. `EnvVars` stays required because
// `EnvVars.layer` is provided at server boot.
const billingCommandGroup = Command.group(
  StartSubscription,
  CancelSubscription,
  IngestStripeWebhook,
  SyncSubscription,
);

const BillingCommandHandlersLive = Command.handlersOf(billingCommandGroup, {
  StartSubscriptionCommand: (payload) =>
    startSubscription(payload).pipe(Effect.provide(SubscriptionRepositoryLive)),
  CancelSubscriptionCommand: (payload) =>
    cancelSubscription(payload).pipe(Effect.provide(SubscriptionRepositoryLive)),
  IngestStripeWebhookCommand: (payload) =>
    ingestStripeWebhook(payload).pipe(Effect.provide(WebhookEventRepositoryLive)),
  SyncSubscriptionCommand: (payload) =>
    syncSubscription(payload).pipe(Effect.provide(SubscriptionRepositoryLive)),
});

// Neither webhook field reaches a span: the raw body is unbounded and the signature is a
// credential.
const billingCommandSpanAttributes: Command.SpanAttributes<typeof billingCommandGroup> = {
  StartSubscriptionCommand: (payload) => ({ "organization.id": payload.organizationId }),
  CancelSubscriptionCommand: (payload) => ({ "organization.id": payload.organizationId }),
  SyncSubscriptionCommand: (payload) => ({
    "billing.stripe.subscription.id": payload.stripeSubscriptionId,
    "billing.subscription.status": payload.status,
  }),
};

export class BillingCommands extends Context.Service<
  BillingCommands,
  Command.Dispatcher<typeof billingCommandGroup>
>()("@org/server/billing/BillingCommands") {}

const makeBillingCommandsLive = (gateway: Layer.Layer<BillingGateway, never, EnvVars>) =>
  Layer.effect(
    BillingCommands,
    Command.dispatcher(billingCommandGroup, { spanAttributes: billingCommandSpanAttributes }),
  ).pipe(Layer.provide(BillingCommandHandlersLive.pipe(Layer.provide(gateway))));

export const BillingCommandsLive = makeBillingCommandsLive(BillingGatewayLive);

export const BillingCommandsFake = makeBillingCommandsLive(BillingGatewayFake);
