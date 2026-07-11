import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { CancelSubscriptionCommand } from "@/modules/billing/commands/cancel-subscription.command.js";
import { cancelSubscription } from "@/modules/billing/commands/cancel-subscription.handler.js";
import { SubscriptionNotFound } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { type SubscriptionCanceled } from "@/modules/billing/domain/subscription/subscription.events.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.js";
import { BillingGatewayFake } from "@/modules/billing/infrastructure/clients/billing-gateway.client-fake.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/repositories/subscription.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const subId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const TestLayer = Layer.mergeAll(
  SubscriptionRepositoryFake,
  BillingGatewayFake,
  RecordingEventBus,
  IdentityUnitOfWork,
);

const seed = (status = "active") =>
  Effect.gen(function* () {
    const repo = yield* SubscriptionRepository;
    const { subscription } = SubscriptionRootOps.create({
      id: subId,
      organizationId: acme,
      stripeCustomerId: "cus_seed",
      stripeSubscriptionId: "sub_seed",
      status,
      currentPeriodEnd: null,
      now,
    });
    yield* repo.insertOne(subscription);
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

      const found = yield* repo.findOneByOrganizationId(acme);
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
      if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
        ok(
          Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof SubscriptionNotFound,
        );
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
