import { OrganizationId, SubscriptionId } from "@org/contracts/EntityIds";
import { describe, expect, it } from "vitest";

import { computeBillingPanelView } from "./billing-panel.view-model";

const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const subId = SubscriptionId.make("22222222-2222-2222-2222-222222222222");

// Period-end comes through as an ISO string on the client — that's what
// dehydrate → JSON → hydrate produces from `Schema.DateTimeUtc`. See the
// view-model's `formatDate` comment.
const makeSub = (status: string, currentPeriodEnd: string | null = null) =>
  ({
    id: subId,
    organizationId: orgId,
    status,
    currentPeriodEnd,
  }) as never;

describe("computeBillingPanelView", () => {
  it("returns the empty-state shape when there's no subscription", () => {
    const view = computeBillingPanelView(null);
    expect(view).toEqual({
      hasSubscription: false,
      statusLabel: "No subscription",
      statusVariant: "secondary",
      currentPeriodEndLabel: null,
      canStart: true,
      canCancel: false,
    });
  });

  it("maps active → default variant, cancelable", () => {
    const view = computeBillingPanelView(makeSub("active"));
    expect(view.statusLabel).toBe("Active");
    expect(view.statusVariant).toBe("default");
    expect(view.canStart).toBe(false);
    expect(view.canCancel).toBe(true);
  });

  it("maps past_due → destructive, cancelable", () => {
    const view = computeBillingPanelView(makeSub("past_due"));
    expect(view.statusVariant).toBe("destructive");
    expect(view.canCancel).toBe(true);
  });

  it("maps canceled → outline, NOT cancelable", () => {
    const view = computeBillingPanelView(makeSub("canceled"));
    expect(view.statusVariant).toBe("outline");
    expect(view.canCancel).toBe(false);
  });

  it("falls back to the raw status string for unknown statuses", () => {
    const view = computeBillingPanelView(makeSub("future_stripe_status"));
    expect(view.statusLabel).toBe("future_stripe_status");
    expect(view.statusVariant).toBe("secondary");
  });

  it("formats the period-end date as ISO yyyy-mm-dd", () => {
    const view = computeBillingPanelView(makeSub("active", "2026-12-31T00:00:00.000Z"));
    expect(view.currentPeriodEndLabel).toBe("2026-12-31");
  });

  it("null period-end yields null label", () => {
    const view = computeBillingPanelView(makeSub("active", null));
    expect(view.currentPeriodEndLabel).toBeNull();
  });
});
