import { deepStrictEqual, ok } from "node:assert";

import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.ts";
import { WebhookEventRepository } from "@/modules/billing/domain/webhook-event/webhook-event.repository.ts";
import { WebhookEventSpecifications } from "@/modules/billing/domain/webhook-event/webhook-event.specification.ts";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/repositories/webhook-event.repository-live.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const TestLayer = WebhookEventRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "WebhookEventRepositoryLive (integration)",
  { layer: TestLayer, tables: ["billing.webhook_events"] },
  (it) => {
    it.effect("inserts an event id and decodes it back via findOne", () =>
      Effect.gen(function* () {
        const repo = yield* WebhookEventRepository;
        yield* repo.insertOne("evt_test_1");

        const found = yield* Effect.fromOption(
          yield* repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_test_1")),
        );

        deepStrictEqual(found.stripeEventId, "evt_test_1");
      }),
    );

    it.effect(
      "fails WebhookEventAlreadyRecorded on a duplicate insert (unique violation → domain error)",
      () =>
        Effect.gen(function* () {
          const repo = yield* WebhookEventRepository;
          yield* repo.insertOne("evt_test_dup");
          const error = yield* Effect.flip(repo.insertOne("evt_test_dup"));
          ok(Schema.is(WebhookEventAlreadyRecorded)(error));
        }),
    );

    it.effect("returns null for an unrecorded event id", () =>
      Effect.gen(function* () {
        const repo = yield* WebhookEventRepository;

        const found = yield* repo.findOne(
          WebhookEventSpecifications.withStripeEventId("evt_does_not_exist"),
        );

        assertNone(found);
      }),
    );
  },
);
