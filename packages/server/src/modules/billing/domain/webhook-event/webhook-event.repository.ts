import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable";
import { type Specification } from "@/globals/application/ddd/specification";
import { type WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors";

// Dumb idempotency log for Stripe webhook deliveries: write-once,
// keyed by Stripe's event id. No aggregate — the row carries no
// state worth modeling beyond "have we seen this id before?".
//
// `insertOne` is the claim; if Stripe redelivers the same event, the
// conflicting insert surfaces as `WebhookEventAlreadyRecorded` and
// the caller (the webhook endpoint) decides to short-circuit. The
// race-free idempotency comes from the database, not the use case.
//
// The read side is a plain `findOne` over a Specification (see
// WebhookEventSpecifications); absence is `None`.
export type WebhookEventRecord = {
  readonly stripeEventId: string;
  readonly receivedAt: DateTime.Utc;
};

export type WebhookEventRepositoryService = {
  readonly insertOne: (
    stripeEventId: string,
  ) => Effect.Effect<void, WebhookEventAlreadyRecorded | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<WebhookEventRecord>,
  ) => Effect.Effect<Option.Option<WebhookEventRecord>, PersistenceUnavailable>;
};

export class WebhookEventRepository extends Context.Service<
  WebhookEventRepository,
  WebhookEventRepositoryService
>()("WebhookEventRepository") {}
