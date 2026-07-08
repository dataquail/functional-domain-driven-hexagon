import * as Cause from "effect/Cause";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event.repository.js";
import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event.errors.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/repositories/webhook-event.repository-live.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const TestLayer = WebhookEventRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));
const suite = describe.sequential;

suite("WebhookEventRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("billing.webhook_events").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("inserts an event id and decodes it back via findOneByStripeEventId", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      yield* repo.insertOne("evt_test_1");
      const found = yield* repo.findOneByStripeEventId("evt_test_1");
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.stripeEventId, "evt_test_1");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "fails WebhookEventAlreadyRecorded on a duplicate insert (unique violation → domain error)",
    () =>
      Effect.gen(function* () {
        const repo = yield* WebhookEventRepository;
        yield* repo.insertOne("evt_test_dup");
        const exit = yield* Effect.exit(repo.insertOne("evt_test_dup"));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof WebhookEventAlreadyRecorded);
        }
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns None for an unrecorded event id", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const found = yield* repo.findOneByStripeEventId("evt_does_not_exist");
      ok(Option.isNone(found));
    }).pipe(Effect.provide(TestLayer)),
  );
});
