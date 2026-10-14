<script lang="ts">
  import CardSection from "@org/components/patterns/card-section.svelte";
  import PageShell from "@org/components/patterns/page-shell.svelte";
  import Skeleton from "@org/components/primitives/skeleton.svelte";
  import Stack from "@org/components/primitives/stack.svelte";

  import OrgsList from "@/features/admin/orgs-list/orgs-list.view.svelte";
  import { PAGE_SIZE } from "@/features/admin/orgs-list/orgs-list.view-model";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";

  import type { load } from "./+page.server";

  const { data }: { readonly data: Awaited<ReturnType<typeof load>> } = $props();
</script>

<PageShell>
  <CardSection title="All organizations">
    <HydrationBoundary state={data.prefetched}>
      <OrgsList />
      {#snippet pending()}
        <Stack direction="column" gap="sm">
          {#each Array.from({ length: PAGE_SIZE }, (_, index) => index) as index (index)}
            <Skeleton height="row" />
          {/each}
        </Stack>
      {/snippet}
    </HydrationBoundary>
  </CardSection>
</PageShell>
