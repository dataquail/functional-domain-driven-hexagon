import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";

import { type WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb idempotency log for Stripe webhook deliveries: write-once,
// keyed by Stripe's event id. No aggregate — the row carries no
// state worth modeling beyond "have we seen this id before?".
//
// `insertOne` is the claim; if Stripe redelivers the same event, the
// unique-key violation surfaces as `WebhookEventAlreadyRecorded` and
// the caller (the webhook endpoint) decides to short-circuit. The
// race-free idempotency comes from the database, not the use case.
//
// The read side is a plain `findOne` over a Specification (see
// WebhookEventSpecifications); absence is a plain `null`.
export type WebhookEventRecord = {
  readonly stripeEventId: string;
  readonly receivedAt: DateTime.Utc;
};

export type WebhookEventRepositoryShape = {
  readonly insertOne: (
    stripeEventId: string,
  ) => Effect.Effect<void, WebhookEventAlreadyRecorded | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<WebhookEventRecord>,
  ) => Effect.Effect<WebhookEventRecord | null, PersistenceUnavailable>;
};

export class WebhookEventRepository extends Context.Service<
  WebhookEventRepository,
  WebhookEventRepositoryShape
>()("WebhookEventRepository") {}
