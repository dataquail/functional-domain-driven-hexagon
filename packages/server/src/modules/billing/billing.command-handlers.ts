import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type EnvVars } from "@/common/env-vars.js";
import { CancelSubscriptionCommand } from "@/modules/billing/commands/cancel-subscription.command.js";
import { cancelSubscriptionHandler } from "@/modules/billing/commands/cancel-subscription.handler.js";
import { IngestStripeWebhookCommand } from "@/modules/billing/commands/ingest-stripe-webhook.command.js";
import { ingestStripeWebhookHandler } from "@/modules/billing/commands/ingest-stripe-webhook.handler.js";
import { StartSubscriptionCommand } from "@/modules/billing/commands/start-subscription.command.js";
import { startSubscriptionHandler } from "@/modules/billing/commands/start-subscription.handler.js";
import { SyncSubscriptionCommand } from "@/modules/billing/commands/sync-subscription.command.js";
import { syncSubscriptionHandler } from "@/modules/billing/commands/sync-subscription.handler.js";
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
  StartSubscriptionCommand,
  CancelSubscriptionCommand,
  IngestStripeWebhookCommand,
  SyncSubscriptionCommand,
);

const BillingCommandHandlersLive = Command.handlersOf(billingCommandGroup, {
  StartSubscriptionCommand: (payload) =>
    startSubscriptionHandler(payload).pipe(Effect.provide(SubscriptionRepositoryLive)),
  CancelSubscriptionCommand: (payload) =>
    cancelSubscriptionHandler(payload).pipe(Effect.provide(SubscriptionRepositoryLive)),
  IngestStripeWebhookCommand: (payload) =>
    ingestStripeWebhookHandler(payload).pipe(Effect.provide(WebhookEventRepositoryLive)),
  SyncSubscriptionCommand: (payload) =>
    syncSubscriptionHandler(payload).pipe(Effect.provide(SubscriptionRepositoryLive)),
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
