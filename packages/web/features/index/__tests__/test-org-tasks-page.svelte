<script lang="ts">
  import AddTodo from "@/features/index/add-todo/add-todo.view.svelte";
  import TodoList from "@/features/index/todo-list.view.svelte";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";
  import { TEST_ORG_ID } from "@/test/fixtures";
</script>

<!-- The real route prefetches on the server; here TodoList fetches through MSW. -->
<div>
  <AddTodo orgId={TEST_ORG_ID} />
  <HydrationBoundary state={[]}>
    <TodoList orgId={TEST_ORG_ID} />
    {#snippet pending()}
      <div data-testid="todos-loading"></div>
    {/snippet}
  </HydrationBoundary>
</div>
