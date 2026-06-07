import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { markSubscriptionStatus } from "@/modules/billing/commands/mark-subscription-status.js";
import { MarkSubscriptionStatusCommand } from "@/modules/billing/commands/mark-subscription-status-command.js";
import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import * as Subscription from "@/modules/billing/domain/subscription.aggregate.js";
import { type SubscriptionStatusChanged } from "@/modules/billing/domain/subscription-events.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription-id.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/subscription-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const subId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const TestLayer = Layer.mergeAll(SubscriptionRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

const seed = () =>
  Effect.gen(function* () {
    const repo = yield* SubscriptionRepository;
    const { subscription } = Subscription.create({
      id: subId,
      organizationId: acme,
      stripeCustomerId: "cus_seed",
      stripeSubscriptionId: "sub_seed",
      status: "trialing",
      currentPeriodEnd: null,
      now,
    });
    yield* repo.insert(subscription);
  });

describe("markSubscriptionStatus", () => {
  it.effect("updates an existing subscription's status and emits SubscriptionStatusChanged", () =>
    Effect.gen(function* () {
      yield* seed();
      const repo = yield* SubscriptionRepository;
      const rec = yield* RecordedEvents;

      yield* markSubscriptionStatus(
        MarkSubscriptionStatusCommand.make({
          stripeSubscriptionId: "sub_seed",
          status: "active",
          currentPeriodEnd: null,
        }),
      );

      const found = yield* repo.findByOrganizationId(acme);
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.status, "active");

      const events = yield* rec.byTag<SubscriptionStatusChanged>("SubscriptionStatusChanged");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected SubscriptionStatusChanged");
      deepStrictEqual(event.status, "active");
      deepStrictEqual(event.previousStatus, "trialing");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("is a no-op when no subscription matches the Stripe id (out-of-order webhook)", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* markSubscriptionStatus(
        MarkSubscriptionStatusCommand.make({
          stripeSubscriptionId: "sub_does_not_exist",
          status: "active",
          currentPeriodEnd: null,
        }),
      );
      const events = yield* rec.byTag<SubscriptionStatusChanged>("SubscriptionStatusChanged");
      deepStrictEqual(events.length, 0);
    }).pipe(Effect.provide(TestLayer)),
  );
});
