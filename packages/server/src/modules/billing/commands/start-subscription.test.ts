import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { startSubscription } from "@/modules/billing/commands/start-subscription.js";
import { StartSubscriptionCommand } from "@/modules/billing/commands/start-subscription-command.js";
import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription-errors.js";
import { type SubscriptionStarted } from "@/modules/billing/domain/subscription-events.js";
import { FakeBillingGatewayLive } from "@/modules/billing/infrastructure/fake-billing-gateway.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/subscription-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");

const TestLayer = Layer.mergeAll(
  SubscriptionRepositoryFake,
  FakeBillingGatewayLive,
  RecordingEventBus,
  IdentityUnitOfWork,
);

describe("startSubscription", () => {
  it.effect(
    "creates Stripe customer + sub, persists subscription, publishes SubscriptionStarted",
    () =>
      Effect.gen(function* () {
        const repo = yield* SubscriptionRepository;
        const rec = yield* RecordedEvents;

        const sub = yield* startSubscription(
          StartSubscriptionCommand.make({ organizationId: acme }),
        );
        deepStrictEqual(sub.organizationId, acme);
        ok(sub.stripeCustomerId.startsWith("cus_test_"));
        ok(sub.stripeSubscriptionId.startsWith("sub_test_"));
        deepStrictEqual(sub.status, "active");

        const stored = yield* repo.findOneByOrganizationId(acme);
        ok(Option.isSome(stored));

        const events = yield* rec.byTag<SubscriptionStarted>("SubscriptionStarted");
        deepStrictEqual(events.length, 1);
        const event = events[0];
        if (event === undefined) throw new Error("expected SubscriptionStarted");
        deepStrictEqual(event.organizationId, acme);
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "fails SubscriptionAlreadyExistsForOrganization on a second start for the same org",
    () =>
      Effect.gen(function* () {
        yield* startSubscription(StartSubscriptionCommand.make({ organizationId: acme }));
        const exit = yield* Effect.exit(
          startSubscription(StartSubscriptionCommand.make({ organizationId: acme })),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof SubscriptionAlreadyExistsForOrganization);
        }
      }).pipe(Effect.provide(TestLayer)),
  );
});
