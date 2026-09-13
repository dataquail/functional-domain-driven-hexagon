import { Command } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { CancelSubscriptionCommand } from "@/modules/billing/commands/cancel-subscription.command.js";
import { cancelSubscriptionHandler } from "@/modules/billing/commands/cancel-subscription.handler.js";
import { IngestStripeWebhookCommand } from "@/modules/billing/commands/ingest-stripe-webhook.command.js";
import { ingestStripeWebhookHandler } from "@/modules/billing/commands/ingest-stripe-webhook.handler.js";
import { StartSubscriptionCommand } from "@/modules/billing/commands/start-subscription.command.js";
import { startSubscriptionHandler } from "@/modules/billing/commands/start-subscription.handler.js";
import { SyncSubscriptionCommand } from "@/modules/billing/commands/sync-subscription.command.js";
import { syncSubscriptionHandler } from "@/modules/billing/commands/sync-subscription.handler.js";
import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/repositories/subscription.repository-live.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/repositories/webhook-event.repository-live.js";

// Repositories are owned-and-static, so each entry below discharges its own. The gateway
// is the integration seam and stays required: which adapter satisfies it is the one thing
// about this module that differs between production and the test runtime, and that is a
// composition root's choice to make.
export const billingCommandGroup = Command.group(
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

export const BillingCommandsLive = Layer.effect(
  BillingCommands,
  Command.dispatcher(billingCommandGroup, { spanAttributes: billingCommandSpanAttributes }),
).pipe(Layer.provide(BillingCommandHandlersLive));
