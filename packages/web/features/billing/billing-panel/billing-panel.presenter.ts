"use client";

// Presenter for BillingPanel (ADR-0014 Tier 2). The suspense query
// reads the current subscription — the data-access Effect folds the
// 404 "no subscription" case into a plain `null`, so the empty state
// is data, not an error.

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as React from "react";

import {
  useCancelSubscriptionMutation,
  useCurrentSubscriptionSuspenseQuery,
  useStartSubscriptionMutation,
} from "@/services/data-access/use-billing-queries";

import { computeBillingPanelView } from "./billing-panel.view-model";

export const useBillingPanelPresenter = (orgId: OrganizationId) => {
  const subscriptionQuery = useCurrentSubscriptionSuspenseQuery(orgId);
  const startMutation = useStartSubscriptionMutation();
  const cancelMutation = useCancelSubscriptionMutation();

  const view = computeBillingPanelView(subscriptionQuery.data);

  const onStart = React.useCallback(() => {
    startMutation.mutate({ orgId });
  }, [orgId, startMutation]);

  const onCancel = React.useCallback(() => {
    cancelMutation.mutate({ orgId });
  }, [orgId, cancelMutation]);

  return {
    ...view,
    onStart,
    onCancel,
    isStarting: startMutation.isPending,
    isCanceling: cancelMutation.isPending,
  };
};
