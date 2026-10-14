<script lang="ts">
  import CardSection from "@org/components-svelte/patterns/card-section.svelte";
  import PageShell from "@org/components-svelte/patterns/page-shell.svelte";
  import Skeleton from "@org/components-svelte/primitives/skeleton.svelte";
  import Stack from "@org/components-svelte/primitives/stack.svelte";

  import BillingPanel from "@/features/billing/billing-panel/billing-panel.view.svelte";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";

  import type { load as orgLoad } from "../+layout.server";
  import type { load } from "./+page.server";

  const {
    data,
  }: {
    readonly data: Awaited<ReturnType<typeof load>> & Awaited<ReturnType<typeof orgLoad>>;
  } = $props();
</script>

<PageShell>
  <CardSection title="Billing">
    <HydrationBoundary state={data.prefetched}>
      <BillingPanel orgId={data.orgId} />
      {#snippet pending()}
        <Stack direction="column" gap="lg">
          <Skeleton height="control" width="half" />
          <Skeleton height="control" width="half" />
        </Stack>
      {/snippet}
    </HydrationBoundary>
  </CardSection>
</PageShell>
