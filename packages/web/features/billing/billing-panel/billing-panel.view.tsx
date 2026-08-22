"use client";

import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";
import type { OrganizationId } from "@org/contracts/EntityIds";

import {
  billingPanelAtom,
  cancelSubscriptionActionAtom,
  isCancelingAtom,
  isStartingAtom,
  startSubscriptionActionAtom,
  subscriptionResultAtom,
} from "./billing-panel.view-model";

export const BillingPanel: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  useAtomSuspense(subscriptionResultAtom(orgId));
  const view = useAtomValue(billingPanelAtom(orgId));
  const isStarting = useAtomValue(isStartingAtom);
  const isCanceling = useAtomValue(isCancelingAtom);
  const start = useAtomSet(startSubscriptionActionAtom);
  const cancel = useAtomSet(cancelSubscriptionActionAtom);

  return (
    <Stack direction="column" gap="lg" data-testid="billing-panel">
      <Stack direction="row" align="start" justify="between">
        <Stack direction="column" gap="xs">
          <Text weight="medium" tone="muted">
            Status
          </Text>
          <Badge variant={view.statusVariant} data-testid="billing-status">
            {view.statusLabel}
          </Badge>
        </Stack>
        {view.currentPeriodEndLabel !== null && (
          <Stack direction="column" gap="xs" align="end">
            <Text weight="medium" tone="muted" align="end">
              Current period ends
            </Text>
            <Text align="end" data-testid="billing-period-end">
              {view.currentPeriodEndLabel}
            </Text>
          </Stack>
        )}
      </Stack>

      <Stack direction="row" gap="sm">
        {view.canStart && (
          <Button
            onClick={() => {
              start(orgId);
            }}
            disabled={isStarting}
            data-testid="billing-start"
          >
            {isStarting ? "Starting…" : "Start subscription"}
          </Button>
        )}
        {view.canCancel && (
          <Button
            variant="destructive"
            onClick={() => {
              cancel(orgId);
            }}
            disabled={isCanceling}
            data-testid="billing-cancel"
          >
            {isCanceling ? "Canceling…" : "Cancel subscription"}
          </Button>
        )}
      </Stack>
    </Stack>
  );
};
