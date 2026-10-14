import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";

import { Criteria } from "@/globals/application/ddd/specification.ts";

import { type WebhookEventRecord } from "./webhook-event.repository.ts";
import { WebhookEventSpecifications } from "./webhook-event.specification.ts";

const record: WebhookEventRecord = {
  stripeEventId: "evt_abc",
  receivedAt: DateTime.makeUnsafe("2025-01-01T00:00:00Z"),
};

describe("WebhookEventSpecifications.withStripeEventId", () => {
  it("matches the record with the given Stripe event id and no other", () => {
    deepStrictEqual(WebhookEventSpecifications.withStripeEventId("evt_abc")(record), true);
    deepStrictEqual(WebhookEventSpecifications.withStripeEventId("evt_other")(record), false);
  });

  it("carries an Eq criteria over the stripe_event_id column", () => {
    deepStrictEqual(
      WebhookEventSpecifications.withStripeEventId("evt_abc").criteria,
      Criteria.Eq({ field: "stripeEventId", value: "evt_abc" }),
    );
  });
});
