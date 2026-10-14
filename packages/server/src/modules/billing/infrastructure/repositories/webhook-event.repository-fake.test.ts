import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.js";
import { WebhookEventRepository } from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";
import { WebhookEventSpecifications } from "@/modules/billing/domain/webhook-event/webhook-event.specification.js";
import { WebhookEventRepositoryFake } from "@/modules/billing/infrastructure/repositories/webhook-event.repository-fake.js";

const provide = Effect.provide(WebhookEventRepositoryFake);

describe("WebhookEventRepositoryFake.insert", () => {
  it.effect("persists the event id and makes it findable", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      yield* repo.insertOne("evt_abc");

      const found = yield* Effect.fromOption(
        yield* repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_abc")),
      );

      deepStrictEqual(found.stripeEventId, "evt_abc");
    }).pipe(provide),
  );

  it.effect("fails WebhookEventAlreadyRecorded on a duplicate insert", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      yield* repo.insertOne("evt_abc");
      const error = yield* Effect.flip(repo.insertOne("evt_abc"));
      ok(Schema.is(WebhookEventAlreadyRecorded)(error));
    }).pipe(provide),
  );

  it.effect("treats distinct event ids independently", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      yield* repo.insertOne("evt_a");
      yield* repo.insertOne("evt_b");
      const a = yield* repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_a"));
      const b = yield* repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_b"));
      ok(Option.isSome(a) && Option.isSome(b));
    }).pipe(provide),
  );
});

describe("WebhookEventRepositoryFake.findOne", () => {
  it.effect("returns null when no event has been recorded for the id", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;

      const found = yield* repo.findOne(
        WebhookEventSpecifications.withStripeEventId("evt_unknown"),
      );

      assertNone(found);
    }).pipe(provide),
  );
});
