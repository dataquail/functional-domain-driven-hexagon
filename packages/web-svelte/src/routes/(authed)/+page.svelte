<script lang="ts">
  import CardSection from "@org/components-svelte/patterns/card-section.svelte";
  import PageShell from "@org/components-svelte/patterns/page-shell.svelte";
  import { Grid } from "@org/components-svelte/primitives/grid";
  import Skeleton from "@org/components-svelte/primitives/skeleton.svelte";

  import CreateOrg from "@/features/orgs/create-org/create-org.view.svelte";
  import OrgPicker from "@/features/orgs/org-picker/org-picker.view.svelte";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";
</script>

<PageShell>
  <CardSection title="Your organizations">
    <!-- The authed layout prefetched the caller's organizations for the nav. -->
    <HydrationBoundary state={[]}>
      <OrgPicker />
      {#snippet pending()}
        <Grid columnsAbove={2} gap="md">
          {#each [0, 1] as index (index)}
            <Grid.Item>
              <Skeleton height="card" radius="lg" />
            </Grid.Item>
          {/each}
        </Grid>
      {/snippet}
    </HydrationBoundary>
  </CardSection>
  <CardSection title="Create a new organization">
    <CreateOrg />
  </CardSection>
</PageShell>
