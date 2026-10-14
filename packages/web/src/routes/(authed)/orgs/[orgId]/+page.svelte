<script lang="ts">
  import CardSection from "@org/components/patterns/card-section.svelte";
  import PageShell from "@org/components/patterns/page-shell.svelte";
  import Skeleton from "@org/components/primitives/skeleton.svelte";
  import Stack from "@org/components/primitives/stack.svelte";

  import AddTodo from "@/features/index/add-todo/add-todo.view.svelte";
  import TodoList from "@/features/index/todo-list.view.svelte";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";

  import type { load as orgLoad } from "./+layout.server";
  import type { load } from "./+page.server";

  const {
    data,
  }: {
    readonly data: Awaited<ReturnType<typeof load>> & Awaited<ReturnType<typeof orgLoad>>;
  } = $props();
</script>

<PageShell width="sm">
  <CardSection title="My Tasks" titleAlign="center" headerPadding="tight">
    <AddTodo orgId={data.orgId} />
    <HydrationBoundary state={data.prefetched}>
      <TodoList orgId={data.orgId} />
      {#snippet pending()}
        <Stack direction="column" gap="sm">
          {#each [0, 1, 2] as index (index)}
            <Skeleton height="row" />
          {/each}
        </Stack>
      {/snippet}
    </HydrationBoundary>
  </CardSection>
</PageShell>
