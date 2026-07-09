import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";

import { IngestStripeWebhookCommand } from "@/modules/billing/commands/ingest-stripe-webhook.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Pure translation: read raw body (Stripe's `constructEvent` needs
// the exact signed payload, so the endpoint opts out of `setPayload`),
// read the `stripe-signature` header, dispatch ONE command. All
// orchestration — signature verification, parsing, idempotency claim,
// per-type fan-out — lives downstream of the command bus
// (`IngestStripeWebhookCommand` verifies + claims + emits
// `StripeWebhookIngested` → event handler dispatches the next
// command). CQRS alternation: command → event → command.
//
// The endpoint imports no outbound port — the
// `outbound-ports-private-to-use-cases` rule reserves those for the
// use-case layer.
//
// NO `Authz.hasPermissions` — Stripe doesn't carry our session
// cookie. Authentication is by signature, verified inside the
// command handler via `BillingGateway`.
export const stripeWebhookEndpoint = () =>
  Effect.gen(function* () {
    const httpReq = yield* HttpServerRequest.HttpServerRequest;
    const commandBus = yield* CommandBus;

    const signature = httpReq.headers["stripe-signature"];
    if (signature === undefined || signature === "") {
      return yield* Effect.fail(
        new CustomHttpApiError.Unauthorized({ message: "Missing stripe-signature header" }),
      );
    }
    const payload = yield* httpReq.text.pipe(
      Effect.catch((cause) =>
        Effect.fail(
          new CustomHttpApiError.BadRequest({ message: `Failed to read body: ${String(cause)}` }),
        ),
      ),
    );

    yield* commandBus
      .execute(IngestStripeWebhookCommand.make({ payload, signature }))
      .pipe(
        Effect.catchTag("InvalidWebhookSignature", (err) =>
          Effect.fail(new CustomHttpApiError.Unauthorized({ message: err.message })),
        ),
      );
    return undefined;
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("BillingLive.stripeWebhook"));
