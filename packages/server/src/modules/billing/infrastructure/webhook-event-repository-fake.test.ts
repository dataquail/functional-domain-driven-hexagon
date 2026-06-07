import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { WebhookEventRepositoryFake } from "@/modules/billing/infrastructure/webhook-event-repository-fake.js";

const provide = Effect.provide(WebhookEventRepositoryFake);

describe("WebhookEventRepositoryFake.recordIfNew", () => {
  it.effect("returns true on first insert and false on subsequent inserts of the same id", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const first = yield* repo.recordIfNew("evt_abc");
      const second = yield* repo.recordIfNew("evt_abc");
      const third = yield* repo.recordIfNew("evt_abc");
      deepStrictEqual(first, true);
      deepStrictEqual(second, false);
      deepStrictEqual(third, false);
    }).pipe(provide),
  );

  it.effect("treats distinct event ids independently", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const a = yield* repo.recordIfNew("evt_a");
      const b = yield* repo.recordIfNew("evt_b");
      const aRepeat = yield* repo.recordIfNew("evt_a");
      deepStrictEqual(a, true);
      deepStrictEqual(b, true);
      deepStrictEqual(aRepeat, false);
    }).pipe(provide),
  );
});
