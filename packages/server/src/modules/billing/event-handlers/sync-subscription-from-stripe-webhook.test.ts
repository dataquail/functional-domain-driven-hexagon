// Unit test for the same-module event handler. Verifies that
// `StripeWebhookIngested` synchronises the local `Subscription`
// projection from Stripe's reported status. The aggregate's own
// `applyStatus`/`cancel` semantics are covered by
// `subscription.aggregate.test.ts`; the end-to-end chain (HTTP →
// endpoint → ingest command → event → handler) is covered by
// `stripe-webhook.endpoint.integration.test.ts`.

import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type StripeWebhookEvent } from "@/modules/billing/domain/ports/billing-gateway.js";
import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/stripe-webhook-events.js";
import * as Subscription from "@/modules/billing/domain/subscription.aggregate.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription-id.js";
import { SyncSubscriptionFromStripeWebhookLive } from "@/modules/billing/event-handlers/sync-subscription-from-stripe-webhook.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/subscription-repository-fake.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { fakeTransaction } from "@/test-utils/fake-transaction-context.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const subId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const seedNow = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const stripeSubId = "sub_test";

const seedSubscription = () =>
  Effect.gen(function* () {
    const repo = yield* SubscriptionRepository;
    const { subscription } = Subscription.create({
      id: subId,
      organizationId: acme,
      stripeCustomerId: "cus_seed",
      stripeSubscriptionId: stripeSubId,
      status: "trialing",
      currentPeriodEnd: null,
      now: seedNow,
    });
    yield* repo.insert(subscription);
  });

const subEvent = (
  type: "created" | "updated" | "deleted",
  status = "past_due",
): StripeWebhookEvent => ({
  eventId: `evt_test_${type}`,
  type: `customer.subscription.${type}`,
  subscription: {
    stripeSubscriptionId: stripeSubId,
    status,
    currentPeriodEnd: null,
  },
});

const TestLayer = SyncSubscriptionFromStripeWebhookLive.pipe(
  Layer.provideMerge(makeDomainEventBusLive()),
  Layer.provideMerge(SubscriptionRepositoryFake),
);

// The real bus guards that dispatch happens inside a unit of work; in
// production the ingest command's `uow.run` provides the transaction context.
// This handler test dispatches directly, so it supplies a no-op context.
const dispatchAndReadStatus = (ingested: StripeWebhookIngested) =>
  Effect.gen(function* () {
    yield* seedSubscription();
    const bus = yield* DomainEventBus;
    yield* bus.dispatch([ingested]);
    const repo = yield* SubscriptionRepository;
    return yield* repo.findByOrganizationId(acme);
  }).pipe(Database.TransactionContext.provide(fakeTransaction), Effect.provide(TestLayer));

describe("SyncSubscriptionFromStripeWebhookLive", () => {
  it.effect("on customer.subscription.updated → applies the reported status", () =>
    Effect.gen(function* () {
      const found = yield* dispatchAndReadStatus(
        StripeWebhookIngested.make({ stripeEvent: subEvent("updated", "active") }),
      );
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.status, "active");
    }),
  );

  it.effect("on customer.subscription.deleted → forces status to 'canceled'", () =>
    Effect.gen(function* () {
      const found = yield* dispatchAndReadStatus(
        StripeWebhookIngested.make({ stripeEvent: subEvent("deleted") }),
      );
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.status, "canceled");
    }),
  );

  it.effect("on customer.subscription.created → applies the reported status", () =>
    Effect.gen(function* () {
      const found = yield* dispatchAndReadStatus(
        StripeWebhookIngested.make({ stripeEvent: subEvent("created", "active") }),
      );
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.status, "active");
    }),
  );

  it.effect("on invoice.paid → no status change (claim only)", () =>
    Effect.gen(function* () {
      const found = yield* dispatchAndReadStatus(
        StripeWebhookIngested.make({
          stripeEvent: {
            eventId: "evt_test_invoice_paid",
            type: "invoice.paid",
            invoice: { stripeSubscriptionId: null },
          },
        }),
      );
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.status, "trialing");
    }),
  );

  it.effect("on unknown event type → no status change", () =>
    Effect.gen(function* () {
      const found = yield* dispatchAndReadStatus(
        StripeWebhookIngested.make({
          stripeEvent: { eventId: "evt_test_unknown", type: "unknown" },
        }),
      );
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.status, "trialing");
    }),
  );

  it.effect("on out-of-order subscription event (unknown Stripe id) → no-op", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      // No seed; the handler can't find any subscription matching
      // the Stripe id → drops silently.
      yield* bus.dispatch([StripeWebhookIngested.make({ stripeEvent: subEvent("updated") })]);
      const repo = yield* SubscriptionRepository;
      const found = yield* repo.findByOrganizationId(acme);
      ok(Option.isNone(found));
    }).pipe(Database.TransactionContext.provide(fakeTransaction), Effect.provide(TestLayer)),
  );
});
