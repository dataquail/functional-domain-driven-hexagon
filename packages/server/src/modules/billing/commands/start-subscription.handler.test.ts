import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { startSubscriptionHandler } from "@/modules/billing/commands/start-subscription.handler.js";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { type SubscriptionStarted } from "@/modules/billing/domain/subscription/subscription.events.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { SubscriptionSpecifications } from "@/modules/billing/domain/subscription/subscription.specification.js";
import { BillingGatewayFake } from "@/modules/billing/infrastructure/clients/billing-gateway.client-fake.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/repositories/subscription.repository-fake.js";
import { CryptoFake } from "@/test-utils/crypto-fake.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");

const TestLayer = Layer.mergeAll(
  SubscriptionRepositoryFake,
  BillingGatewayFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  CryptoFake,
);

describe("startSubscriptionHandler", () => {
  it.effect(
    "creates Stripe customer + sub, persists subscription, publishes SubscriptionStarted",
    () =>
      Effect.gen(function* () {
        const repo = yield* SubscriptionRepository;
        const rec = yield* RecordedEvents;

        const sub = yield* startSubscriptionHandler({ organizationId: acme });
        deepStrictEqual(sub.organizationId, acme);
        ok(sub.stripeCustomerId.startsWith("cus_test_"));
        ok(sub.stripeSubscriptionId.startsWith("sub_test_"));
        deepStrictEqual(sub.status, "active");

        const stored = yield* Effect.fromOption(
          yield* repo.findOne(SubscriptionSpecifications.forOrganization(acme)),
        );

        deepStrictEqual(stored.id, sub.id);

        const events = yield* rec.byTag<SubscriptionStarted>("SubscriptionStarted");
        deepStrictEqual(events.length, 1);
        const [event] = events;
        assertDefined(event);
        deepStrictEqual(event.organizationId, acme);
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "fails SubscriptionAlreadyExistsForOrganization on a second start for the same org",
    () =>
      Effect.gen(function* () {
        yield* startSubscriptionHandler({ organizationId: acme });
        const error = yield* Effect.flip(startSubscriptionHandler({ organizationId: acme }));
        ok(Schema.is(SubscriptionAlreadyExistsForOrganization)(error));
      }).pipe(Effect.provide(TestLayer)),
  );
});
