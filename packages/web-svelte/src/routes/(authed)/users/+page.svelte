<script lang="ts">
  import CardSection from "@org/components-svelte/patterns/card-section.svelte";
  import PageShell from "@org/components-svelte/patterns/page-shell.svelte";
  import Skeleton from "@org/components-svelte/primitives/skeleton.svelte";
  import Stack from "@org/components-svelte/primitives/stack.svelte";

  import CreateUser from "@/features/users/create-user/create-user.view.svelte";
  import UserList from "@/features/users/user-list.view.svelte";
  import { PAGE_SIZE } from "@/features/users/user-list.view-model";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";

  import type { load } from "./+page.server";

  const { data }: { readonly data: Awaited<ReturnType<typeof load>> } = $props();
</script>

<PageShell>
  <CardSection title="Create user">
    <CreateUser />
  </CardSection>
  <CardSection title="Users">
    <HydrationBoundary state={data.prefetched}>
      <UserList />
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
