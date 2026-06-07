import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { MarkSubscriptionStatusCommand } from "@/modules/billing/commands/mark-subscription-status-command.js";
import { BillingGateway } from "@/modules/billing/domain/ports/billing-gateway.js";
import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Stripe webhook ingress. NO `Authz.hasPermissions` — authentication
// is by signature, verified inside via `BillingGateway`. The endpoint
// opts OUT of `setPayload(...)` in the contract because Stripe's
// `constructEvent` requires the EXACT raw bytes the signature was
// computed over; we read `HttpServerRequest.text` directly.
//
// Idempotency happens BEFORE the command dispatch: Stripe replays
// (manual retries, dashboard re-sends) hit the unique-key insert on
// `billing.webhook_events`. The first delivery dispatches; later
// deliveries 200 with no work.
//
// `customer.subscription.{created,updated,deleted}` all fan out to
// `MarkSubscriptionStatusCommand` — the local Subscription is a
// status projection, not an event-sourced timeline. The `deleted`
// case is just the `updated` case with status=`canceled`.
//
// Unknown event types are recorded for idempotency and 200'd. Stripe
// pushes events we haven't modeled yet (new product features); we
// don't want it retrying our endpoint forever.
export const stripeWebhookEndpoint = () =>
  Effect.gen(function* () {
    const httpReq = yield* HttpServerRequest.HttpServerRequest;
    const gateway = yield* BillingGateway;
    const events = yield* WebhookEventRepository;
    const commandBus = yield* CommandBus;

    const signature = httpReq.headers["stripe-signature"];
    if (signature === undefined || signature === "") {
      return yield* Effect.fail(
        new CustomHttpApiError.Unauthorized({ message: "Missing stripe-signature header" }),
      );
    }
    const payload = yield* httpReq.text.pipe(
      Effect.catchAll((cause) =>
        Effect.fail(
          new CustomHttpApiError.BadRequest({ message: `Failed to read body: ${String(cause)}` }),
        ),
      ),
    );

    const event = yield* gateway
      .verifyAndParseWebhook({ payload, signature })
      .pipe(
        Effect.catchTag("InvalidWebhookSignature", (err) =>
          Effect.fail(new CustomHttpApiError.Unauthorized({ message: err.message })),
        ),
      );

    const isNew = yield* events.recordIfNew(event.eventId);
    if (!isNew) {
      // Duplicate delivery. ACK with 200 and stop — the first delivery
      // already did the work.
      return undefined;
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        yield* commandBus.execute(
          MarkSubscriptionStatusCommand.make({
            stripeSubscriptionId: event.subscription.stripeSubscriptionId,
            status: event.subscription.status,
            currentPeriodEnd: event.subscription.currentPeriodEnd,
          }),
        );
        return undefined;
      }
      case "customer.subscription.deleted": {
        yield* commandBus.execute(
          MarkSubscriptionStatusCommand.make({
            stripeSubscriptionId: event.subscription.stripeSubscriptionId,
            status: "canceled",
            currentPeriodEnd: event.subscription.currentPeriodEnd,
          }),
        );
        return undefined;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        // MVP: idempotency-recorded and 200'd, but no domain action.
        // Real handling (e.g. update credit balance on `invoice.paid`,
        // notify on `payment_failed`) lands when a product surface
        // needs it.
        return undefined;
      }
      case "unknown":
        return undefined;
    }
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("BillingLive.stripeWebhook"));
