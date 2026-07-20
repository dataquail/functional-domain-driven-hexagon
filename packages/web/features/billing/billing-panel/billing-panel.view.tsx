"use client";

// Leaf component for the org's billing panel. Pure JSX over the
// presenter's view-model output.

import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useBillingPanelPresenter } from "./billing-panel.presenter";

export const BillingPanel: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const {
    canCancel,
    canStart,
    currentPeriodEndLabel,
    isCanceling,
    isStarting,
    onCancel,
    onStart,
    statusLabel,
    statusVariant,
  } = useBillingPanelPresenter(orgId);

  return (
    <div className="space-y-4" data-testid="billing-panel">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <Badge variant={statusVariant} data-testid="billing-status">
            {statusLabel}
          </Badge>
        </div>
        {currentPeriodEndLabel !== null ? (
          <div className="space-y-1 text-right">
            <p className="text-sm font-medium text-muted-foreground">Current period ends</p>
            <p className="text-sm" data-testid="billing-period-end">
              {currentPeriodEndLabel}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        {canStart ? (
          <Button type="button" onClick={onStart} disabled={isStarting} data-testid="billing-start">
            {isStarting ? "Starting…" : "Start subscription"}
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onCancel}
            disabled={isCanceling}
            data-testid="billing-cancel"
          >
            {isCanceling ? "Canceling…" : "Cancel subscription"}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
