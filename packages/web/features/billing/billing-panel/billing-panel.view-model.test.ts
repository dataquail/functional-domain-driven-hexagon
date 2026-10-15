import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import {
  BILLING_ORG_ID,
  makeSubscription,
  makeSubscriptionWithoutPeriodEnd,
} from "@/test/fixtures/billing";
import { billingHandlers } from "@/test/handlers/billing";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import {
  billingPanelAtom,
  cancelSubscriptionActionAtom,
  computeBillingPanelView,
  startSubscriptionActionAtom,
  subscriptionResultAtom,
} from "./billing-panel.view-model";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const settle = (registry: AtomRegistry.AtomRegistry) =>
  AtomRegistry.getResult(registry, subscriptionResultAtom(BILLING_ORG_ID), {
    suspendOnWaiting: true,
  });

describe("computeBillingPanelView", () => {
  it("returns the empty-state shape when there's no subscription", () => {
    expect(computeBillingPanelView(Option.none())).toEqual({
      hasSubscription: false,
      statusLabel: "No subscription",
      statusVariant: "secondary",
      canStart: true,
      canCancel: false,
    });
  });

  it.each([
    ["active", "Active", "default", true],
    ["trialing", "Trialing", "default", true],
    ["past_due", "Past due", "destructive", true],
    ["unpaid", "Unpaid", "destructive", true],
    ["incomplete", "Incomplete", "secondary", true],
    ["incomplete_expired", "Incomplete (expired)", "secondary", false],
    ["canceled", "Canceled", "outline", false],
    ["paused", "Paused", "secondary", true],
  ] as const)("maps Stripe's %s to %s", (status, label, variant, cancelable) => {
    const view = computeBillingPanelView(Option.some(makeSubscription({ status })));
    expect(view).toMatchObject({
      hasSubscription: true,
      statusLabel: label,
      statusVariant: variant,
      canStart: false,
      canCancel: cancelable,
    });
  });

  it("renders a status it has never seen verbatim, rather than crashing", () => {
    const view = computeBillingPanelView(
      Option.some(makeSubscription({ status: "some_new_stripe_status" })),
    );

    expect(view.statusLabel).toBe("some_new_stripe_status");
    expect(view.statusVariant).toBe("secondary");
  });

  it("formats the period end as a day", () => {
    expect(computeBillingPanelView(Option.some(makeSubscription())).currentPeriodEndLabel).toBe(
      "2026-03-01",
    );
  });

  it("has no period-end label when the subscription carries none", () => {
    expect(
      computeBillingPanelView(Option.some(makeSubscriptionWithoutPeriodEnd())),
    ).not.toHaveProperty("currentPeriodEndLabel");
  });
});

describe("billing panel ViewModel", () => {
  it.effect("reads the org's current subscription", () =>
    Effect.gen(function* () {
      server.use(billingHandlers.current(Option.some(makeSubscription({ status: "trialing" }))));

      const registry = makeRegistry();
      yield* settle(registry);

      expect(registry.get(billingPanelAtom(BILLING_ORG_ID))).toMatchObject({
        hasSubscription: true,
        statusLabel: "Trialing",
      });
    }),
  );

  it.effect("treats the server's 404 as 'no subscription yet', not as a failure", () =>
    Effect.gen(function* () {
      server.use(billingHandlers.current(Option.none()));

      const registry = makeRegistry();
      yield* settle(registry);

      expect(registry.get(billingPanelAtom(BILLING_ORG_ID))).toMatchObject({
        hasSubscription: false,
        canStart: true,
        canCancel: false,
      });
    }),
  );

  it.effect("announces a started subscription", () =>
    Effect.gen(function* () {
      server.use(billingHandlers.current(Option.none()), billingHandlers.start());

      const registry = makeRegistry();
      yield* settle(registry);

      registry.set(startSubscriptionActionAtom, BILLING_ORG_ID);
      yield* AtomRegistry.getResult(registry, startSubscriptionActionAtom, {
        suspendOnWaiting: true,
      });

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Subscription started!",
      });
    }),
  );

  it.effect("surfaces a Stripe outage rather than claiming the subscription started", () =>
    Effect.gen(function* () {
      server.use(
        billingHandlers.current(Option.none()),
        billingHandlers.start({ result: "BadGateway" }),
      );

      const registry = makeRegistry();
      yield* settle(registry);

      registry.set(startSubscriptionActionAtom, BILLING_ORG_ID);
      yield* Effect.exit(
        AtomRegistry.getResult(registry, startSubscriptionActionAtom, { suspendOnWaiting: true }),
      );

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "error",
        message: "Stripe is unreachable.",
      });
    }),
  );

  it.effect("announces a cancellation", () =>
    Effect.gen(function* () {
      server.use(billingHandlers.current(), billingHandlers.cancel());

      const registry = makeRegistry();
      yield* settle(registry);

      registry.set(cancelSubscriptionActionAtom, BILLING_ORG_ID);
      yield* AtomRegistry.getResult(registry, cancelSubscriptionActionAtom, {
        suspendOnWaiting: true,
      });

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Subscription canceled.",
      });
    }),
  );
});
