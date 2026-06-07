import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { cancelSubscription } from "@/modules/billing/commands/cancel-subscription.js";
import { CancelSubscriptionCommand } from "@/modules/billing/commands/cancel-subscription-command.js";
import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import * as Subscription from "@/modules/billing/domain/subscription.aggregate.js";
import { SubscriptionNotFound } from "@/modules/billing/domain/subscription-errors.js";
import { type SubscriptionCanceled } from "@/modules/billing/domain/subscription-events.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription-id.js";
import { FakeBillingGatewayLive } from "@/modules/billing/infrastructure/fake-billing-gateway.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/subscription-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const subId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const TestLayer = Layer.mergeAll(
  SubscriptionRepositoryFake,
  FakeBillingGatewayLive,
  RecordingEventBus,
  IdentityUnitOfWork,
);

const seed = (status = "active") =>
  Effect.gen(function* () {
    const repo = yield* SubscriptionRepository;
    const { subscription } = Subscription.create({
      id: subId,
      organizationId: acme,
      stripeCustomerId: "cus_seed",
      stripeSubscriptionId: "sub_seed",
      status,
      currentPeriodEnd: null,
      now,
    });
    yield* repo.insert(subscription);
  });

describe("cancelSubscription", () => {
  it.effect("flips status to 'canceled', persists, publishes SubscriptionCanceled", () =>
    Effect.gen(function* () {
      yield* seed();
      const repo = yield* SubscriptionRepository;
      const rec = yield* RecordedEvents;

      const result = yield* cancelSubscription(
        CancelSubscriptionCommand.make({ organizationId: acme }),
      );
      deepStrictEqual(result.status, "canceled");

      const found = yield* repo.findByOrganizationId(acme);
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.status, "canceled");

      const events = yield* rec.byTag<SubscriptionCanceled>("SubscriptionCanceled");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails SubscriptionNotFound when no subscription exists for the org", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        cancelSubscription(CancelSubscriptionCommand.make({ organizationId: acme })),
      );
      ok(Exit.isFailure(exit));
      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        ok(exit.cause.error instanceof SubscriptionNotFound);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
