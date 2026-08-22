import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { BILLING_ORG_ID, makeSubscription } from "@/test/fixtures/billing";
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
  Effect.runPromise(
    AtomRegistry.getResult(registry, subscriptionResultAtom(BILLING_ORG_ID), {
      suspendOnWaiting: true,
    }),
  );

describe("computeBillingPanelView", () => {
  it("returns the empty-state shape when there's no subscription", () => {
    expect(computeBillingPanelView(null)).toEqual({
      hasSubscription: false,
      statusLabel: "No subscription",
      statusVariant: "secondary",
      currentPeriodEndLabel: null,
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
    const view = computeBillingPanelView(makeSubscription({ status }));
    expect(view).toMatchObject({
      hasSubscription: true,
      statusLabel: label,
      statusVariant: variant,
      canStart: false,
      canCancel: cancelable,
    });
  });

  it("renders a status it has never seen verbatim, rather than crashing", () => {
    const view = computeBillingPanelView(makeSubscription({ status: "some_new_stripe_status" }));
    expect(view.statusLabel).toBe("some_new_stripe_status");
    expect(view.statusVariant).toBe("secondary");
  });

  it("formats the period end as a day", () => {
    expect(computeBillingPanelView(makeSubscription()).currentPeriodEndLabel).toBe("2026-03-01");
  });

  it("has no period-end label when the subscription carries none", () => {
    expect(
      computeBillingPanelView(makeSubscription({ currentPeriodEnd: null })).currentPeriodEndLabel,
    ).toBeNull();
  });
});

describe("billing panel ViewModel", () => {
  it("reads the org's current subscription", async () => {
    server.use(billingHandlers.current(makeSubscription({ status: "trialing" })));

    const registry = makeRegistry();
    await settle(registry);

    expect(registry.get(billingPanelAtom(BILLING_ORG_ID))).toMatchObject({
      hasSubscription: true,
      statusLabel: "Trialing",
    });
  });

  it("treats the server's 404 as 'no subscription yet', not as a failure", async () => {
    server.use(billingHandlers.current(null));

    const registry = makeRegistry();
    await settle(registry);

    expect(registry.get(billingPanelAtom(BILLING_ORG_ID))).toMatchObject({
      hasSubscription: false,
      canStart: true,
      canCancel: false,
    });
  });

  it("announces a started subscription", async () => {
    server.use(billingHandlers.current(null), billingHandlers.start());

    const registry = makeRegistry();
    await settle(registry);

    registry.set(startSubscriptionActionAtom, BILLING_ORG_ID);
    await Effect.runPromise(
      AtomRegistry.getResult(registry, startSubscriptionActionAtom, { suspendOnWaiting: true }),
    );

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Subscription started!",
    });
  });

  it("surfaces a Stripe outage rather than claiming the subscription started", async () => {
    server.use(billingHandlers.current(null), billingHandlers.start({ result: "BadGateway" }));

    const registry = makeRegistry();
    await settle(registry);

    registry.set(startSubscriptionActionAtom, BILLING_ORG_ID);
    await Effect.runPromise(
      AtomRegistry.getResult(registry, startSubscriptionActionAtom, { suspendOnWaiting: true }),
    ).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "error",
      message: "Stripe is unreachable.",
    });
  });

  it("announces a cancellation", async () => {
    server.use(billingHandlers.current(), billingHandlers.cancel());

    const registry = makeRegistry();
    await settle(registry);

    registry.set(cancelSubscriptionActionAtom, BILLING_ORG_ID);
    await Effect.runPromise(
      AtomRegistry.getResult(registry, cancelSubscriptionActionAtom, { suspendOnWaiting: true }),
    );

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Subscription canceled.",
    });
  });
});
