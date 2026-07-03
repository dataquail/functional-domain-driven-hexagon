import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event.repository.js";
import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event.errors.js";
import { WebhookEventRepositoryFake } from "@/modules/billing/infrastructure/repositories/webhook-event.repository-fake.js";

const provide = Effect.provide(WebhookEventRepositoryFake);

describe("WebhookEventRepositoryFake.insert", () => {
  it.effect("persists the event id and makes it findable", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      yield* repo.insertOne("evt_abc");
      const found = yield* repo.findOneByStripeEventId("evt_abc");
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.stripeEventId, "evt_abc");
    }).pipe(provide),
  );

  it.effect("fails WebhookEventAlreadyRecorded on a duplicate insert", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      yield* repo.insertOne("evt_abc");
      const exit = yield* Effect.exit(repo.insertOne("evt_abc"));
      ok(Exit.isFailure(exit));
      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        ok(exit.cause.error instanceof WebhookEventAlreadyRecorded);
      }
    }).pipe(provide),
  );

  it.effect("treats distinct event ids independently", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      yield* repo.insertOne("evt_a");
      yield* repo.insertOne("evt_b");
      const a = yield* repo.findOneByStripeEventId("evt_a");
      const b = yield* repo.findOneByStripeEventId("evt_b");
      ok(Option.isSome(a) && Option.isSome(b));
    }).pipe(provide),
  );
});

describe("WebhookEventRepositoryFake.findOneByStripeEventId", () => {
  it.effect("returns None when no event has been recorded for the id", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const found = yield* repo.findOneByStripeEventId("evt_unknown");
      ok(Option.isNone(found));
    }).pipe(provide),
  );
});
