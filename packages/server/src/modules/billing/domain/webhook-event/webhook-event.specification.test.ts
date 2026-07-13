import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { type WebhookEventRecord } from "./webhook-event.repository.js";
import { WebhookEventSpecifications } from "./webhook-event.specification.js";

const record: WebhookEventRecord = {
  stripeEventId: "evt_abc",
  receivedAt: DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z")),
};

describe("WebhookEventSpecifications.withStripeEventId", () => {
  it("matches the record with the given Stripe event id and no other", () => {
    deepStrictEqual(WebhookEventSpecifications.withStripeEventId("evt_abc")(record), true);
    deepStrictEqual(WebhookEventSpecifications.withStripeEventId("evt_other")(record), false);
  });

  it("carries an Eq criteria over the stripe_event_id column", () => {
    deepStrictEqual(WebhookEventSpecifications.withStripeEventId("evt_abc").criteria, {
      _tag: "Eq",
      field: "stripeEventId",
      value: "evt_abc",
    });
  });
});
