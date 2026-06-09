import { OrganizationId, SubscriptionId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBillingPanelPresenter } from "./billing-panel.presenter";

const startMutate = vi.fn();
const cancelMutate = vi.fn();
const subscriptionData = { current: null as unknown };

vi.mock("@/services/data-access/use-billing-queries", () => ({
  useCurrentSubscriptionSuspenseQuery: () => ({ data: subscriptionData.current }),
  useStartSubscriptionMutation: () => ({ mutate: startMutate, isPending: false }),
  useCancelSubscriptionMutation: () => ({ mutate: cancelMutate, isPending: false }),
}));

const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

describe("useBillingPanelPresenter", () => {
  beforeEach(() => {
    startMutate.mockReset();
    cancelMutate.mockReset();
    subscriptionData.current = null;
  });

  it("on null subscription, exposes the empty-state view + start handler", () => {
    const { result } = renderHook(() => useBillingPanelPresenter(orgId));
    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.canStart).toBe(true);
    expect(result.current.canCancel).toBe(false);

    act(() => {
      result.current.onStart();
    });
    expect(startMutate).toHaveBeenCalledWith({ orgId });
  });

  it("on an active subscription, exposes the cancel handler", () => {
    subscriptionData.current = {
      id: SubscriptionId.make("22222222-2222-2222-2222-222222222222"),
      organizationId: orgId,
      status: "active",
      currentPeriodEnd: null,
    };
    const { result } = renderHook(() => useBillingPanelPresenter(orgId));
    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.canCancel).toBe(true);

    act(() => {
      result.current.onCancel();
    });
    expect(cancelMutate).toHaveBeenCalledWith({ orgId });
  });
});
