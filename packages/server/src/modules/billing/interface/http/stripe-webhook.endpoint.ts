import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { IngestStripeWebhookCommand } from "@/modules/billing/commands/ingest-stripe-webhook-command.js";
import { BillingGateway } from "@/modules/billing/domain/ports/billing-gateway.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Pure translation: read raw bytes (Stripe's `constructEvent` needs
// the exact signed payload, so the endpoint opts out of `setPayload`),
// verify the signature, dispatch ONE command. All orchestration —
// idempotency claim, per-type fan-out — lives downstream of the
// command bus (`IngestStripeWebhookCommand` → emits
// `StripeWebhookIngested` → event handler dispatches the next
// command). CQRS alternation: command → event → command.
//
// NO `Authz.hasPermissions` — Stripe doesn't carry our session
// cookie. Authentication is by signature, verified inside via
// `BillingGateway`.
export const stripeWebhookEndpoint = () =>
  Effect.gen(function* () {
    const httpReq = yield* HttpServerRequest.HttpServerRequest;
    const gateway = yield* BillingGateway;
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

    const stripeEvent = yield* gateway
      .verifyAndParseWebhook({ payload, signature })
      .pipe(
        Effect.catchTag("InvalidWebhookSignature", (err) =>
          Effect.fail(new CustomHttpApiError.Unauthorized({ message: err.message })),
        ),
      );

    yield* commandBus.execute(IngestStripeWebhookCommand.make({ stripeEvent }));
    return undefined;
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("BillingLive.stripeWebhook"));
