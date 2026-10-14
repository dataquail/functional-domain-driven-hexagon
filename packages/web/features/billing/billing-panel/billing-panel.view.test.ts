import type * as BillingContract from "@org/contracts/api/BillingContract";
import { screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { renderView } from "@/test/atom-harness";
import { BILLING_ORG_ID, makeSubscription } from "@/test/fixtures/billing";
import { billingHandlers } from "@/test/handlers/billing";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import BillingPanel from "./billing-panel.view.svelte";
import { startSubscriptionActionAtom, subscriptionResultAtom } from "./billing-panel.view-model";

const renderPanel = (subscription: Option.Option<BillingContract.SubscriptionResponse>) => {
  server.use(billingHandlers.current(subscription));

  return renderView(
    BillingPanel,
    { orgId: BILLING_ORG_ID },
    {
      initialValues: [
        [apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }],
        [subscriptionResultAtom(BILLING_ORG_ID), AsyncResult.success(subscription)],
      ],
    },
  );
};

describe("BillingPanel view", () => {
  it("offers to start a subscription when the org has none", () => {
    renderPanel(Option.none());

    expect(screen.getByTestId("billing-status")).toHaveTextContent("No subscription");
    expect(screen.getByTestId("billing-start")).toHaveTextContent("Start subscription");
    expect(screen.queryByTestId("billing-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("billing-period-end")).not.toBeInTheDocument();
  });

  it("shows an active subscription's period end and offers to cancel it", () => {
    renderPanel(Option.some(makeSubscription()));

    expect(screen.getByTestId("billing-status")).toHaveTextContent("Active");
    expect(screen.getByTestId("billing-period-end")).toHaveTextContent("2026-03-01");
    expect(screen.getByTestId("billing-cancel")).toHaveTextContent("Cancel subscription");
    expect(screen.queryByTestId("billing-start")).not.toBeInTheDocument();
  });

  it("dispatches a start for this org", async () => {
    server.use(billingHandlers.start());
    const { registry } = renderPanel(Option.none());

    await userEvent.click(screen.getByTestId("billing-start"));

    expect(AsyncResult.isInitial(registry.get(startSubscriptionActionAtom))).toBe(false);
  });
});
