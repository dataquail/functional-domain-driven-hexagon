import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SyncSubscriptionCommand } from "@/modules/billing/commands/sync-subscription.command.js";
import { syncSubscription } from "@/modules/billing/commands/sync-subscription.handler.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "@/modules/billing/domain/subscription/subscription.specification.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/repositories/subscription.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const subId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const seedNow = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));
const stripeSubId = "sub_test";

const TestLayer = Layer.mergeAll(SubscriptionRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

const seedSubscription = () =>
  Effect.gen(function* () {
    const repo = yield* SubscriptionRepository;
    const { subscription } = SubscriptionRootOps.create({
      id: subId,
      organizationId: acme,
      stripeCustomerId: "cus_seed",
      stripeSubscriptionId: stripeSubId,
      status: "trialing",
      currentPeriodEnd: null,
      now: seedNow,
    });
    yield* repo.insertOne(subscription);
  });

describe("syncSubscription", () => {
  it.effect("applies the reported status and dispatches SubscriptionStatusChanged", () =>
    Effect.gen(function* () {
      yield* seedSubscription();
      const rec = yield* RecordedEvents;

      yield* syncSubscription(
        SyncSubscriptionCommand.make({
          stripeSubscriptionId: stripeSubId,
          status: "active",
          currentPeriodEnd: null,
        }),
      );

      const repo = yield* SubscriptionRepository;
      const found = yield* repo.findOne(SubscriptionSpecifications.forOrganization(acme));
      ok(found !== null);
      deepStrictEqual(found.status, "active");

      const tags = (yield* rec.all).map((e) => e._tag);
      deepStrictEqual(tags, ["SubscriptionStatusChanged"]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("is a no-op for an unknown stripe subscription id (out-of-order delivery)", () =>
    Effect.gen(function* () {
      // No seed — nothing matches the stripe id.
      const rec = yield* RecordedEvents;
      yield* syncSubscription(
        SyncSubscriptionCommand.make({
          stripeSubscriptionId: "sub_never_seen",
          status: "active",
          currentPeriodEnd: null,
        }),
      );
      const repo = yield* SubscriptionRepository;
      const found = yield* repo.findOne(SubscriptionSpecifications.forOrganization(acme));
      deepStrictEqual(found, null);
      deepStrictEqual((yield* rec.all).length, 0);
    }).pipe(Effect.provide(TestLayer)),
  );
});
