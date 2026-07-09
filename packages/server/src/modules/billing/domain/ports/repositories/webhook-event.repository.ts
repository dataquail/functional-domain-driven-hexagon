import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event.errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

// Dumb idempotency log for Stripe webhook deliveries: write-once,
// keyed by Stripe's event id. No aggregate — the row carries no
// state worth modeling beyond "have we seen this id before?".
//
// `insert` is the claim; if Stripe redelivers the same event, the
// unique-key violation surfaces as `WebhookEventAlreadyRecorded` and
// the caller (the webhook endpoint) decides to short-circuit. The
// race-free idempotency comes from the database, not the use case.
export type WebhookEventRecord = {
  readonly stripeEventId: string;
  readonly receivedAt: DateTime.Utc;
};

export type WebhookEventRepositoryShape = {
  readonly insertOne: (
    stripeEventId: string,
  ) => Effect.Effect<void, WebhookEventAlreadyRecorded | PersistenceUnavailable>;
  readonly findOneByStripeEventId: (
    stripeEventId: string,
  ) => Effect.Effect<Option.Option<WebhookEventRecord>, PersistenceUnavailable>;
};

export class WebhookEventRepository extends Context.Service<
  WebhookEventRepository,
  WebhookEventRepositoryShape
>()("WebhookEventRepository") {}
