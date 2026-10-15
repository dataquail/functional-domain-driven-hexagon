<script lang="ts">
  import Badge from "@org/components/primitives/badge.svelte";
  import Button from "@org/components/primitives/button.svelte";
  import Stack from "@org/components/primitives/stack.svelte";
  import Text from "@org/components/primitives/text.svelte";
  import type { OrganizationId } from "@org/contracts/EntityIds";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";
  import AtomResult from "@/services/bridge/atom-result.svelte";

  import {
    billingPanelAtom,
    cancelSubscriptionActionAtom,
    isCancelingAtom,
    isStartingAtom,
    startSubscriptionActionAtom,
    subscriptionResultAtom,
  } from "./billing-panel.view-model";

  const { orgId }: { readonly orgId: OrganizationId } = $props();

  const view = atomValue(() => billingPanelAtom(orgId));
  const isStarting = atomValue(isStartingAtom);
  const isCanceling = atomValue(isCancelingAtom);
  const start = atomSet(startSubscriptionActionAtom);
  const cancel = atomSet(cancelSubscriptionActionAtom);
</script>

<AtomResult atom={subscriptionResultAtom(orgId)}>
  {#snippet children()}
    <Stack direction="column" gap="lg" data-testid="billing-panel">
      <Stack direction="row" align="start" justify="between">
        <Stack direction="column" gap="xs">
          <Text weight="medium" tone="muted">Status</Text>
          <Badge variant={view.current.statusVariant} data-testid="billing-status">
            {view.current.statusLabel}
          </Badge>
        </Stack>
        {#if view.current.currentPeriodEndLabel}
          <Stack direction="column" gap="xs" align="end">
            <Text weight="medium" tone="muted" align="end">Current period ends</Text>
            <Text align="end" data-testid="billing-period-end">
              {view.current.currentPeriodEndLabel}
            </Text>
          </Stack>
        {/if}
      </Stack>

      <Stack direction="row" gap="sm">
        {#if view.current.canStart}
          <Button
            onClick={() => {
              start(orgId);
            }}
            disabled={isStarting.current}
            data-testid="billing-start"
          >
            {isStarting.current ? "Starting…" : "Start subscription"}
          </Button>
        {/if}
        {#if view.current.canCancel}
          <Button
            variant="destructive"
            onClick={() => {
              cancel(orgId);
            }}
            disabled={isCanceling.current}
            data-testid="billing-cancel"
          >
            {isCanceling.current ? "Canceling…" : "Cancel subscription"}
          </Button>
        {/if}
      </Stack>
    </Stack>
  {/snippet}
</AtomResult>
