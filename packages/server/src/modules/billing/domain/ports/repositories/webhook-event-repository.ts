import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

// Idempotency for Stripe webhook deliveries. Stripe may deliver the
// same event multiple times (retries, manual replays from the
// dashboard). The endpoint calls `recordIfNew` before fanning out to
// commands; a `false` short-circuits the rest of the handler.
//
// Single-statement `INSERT ... ON CONFLICT DO NOTHING RETURNING` —
// `recordIfNew` returns true iff a new row was inserted. No
// second-pass logic, no aggregate.
export type WebhookEventRepositoryShape = {
  readonly recordIfNew: (stripeEventId: string) => Effect.Effect<boolean, PersistenceUnavailable>;
};

export class WebhookEventRepository extends Context.Tag("WebhookEventRepository")<
  WebhookEventRepository,
  WebhookEventRepositoryShape
>() {}
