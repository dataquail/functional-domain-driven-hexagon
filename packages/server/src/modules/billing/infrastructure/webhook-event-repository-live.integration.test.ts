import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/webhook-event-repository-live.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const TestLayer = WebhookEventRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));
const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("WebhookEventRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("billing.webhook_events").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("returns true on first delivery, false on a duplicate (idempotency)", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const first = yield* repo.recordIfNew("evt_test_1");
      const second = yield* repo.recordIfNew("evt_test_1");
      deepStrictEqual(first, true);
      deepStrictEqual(second, false);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("treats distinct event ids independently", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const a = yield* repo.recordIfNew("evt_test_a");
      const b = yield* repo.recordIfNew("evt_test_b");
      deepStrictEqual(a, true);
      deepStrictEqual(b, true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
