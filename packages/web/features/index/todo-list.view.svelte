<script lang="ts">
  import EmptyState from "@org/components/patterns/empty-state.svelte";
  import { List } from "@org/components/primitives/list";
  import type { OrganizationId } from "@org/contracts/EntityIds";

  import { atomValue } from "@/services/bridge/atom-bridge.svelte";
  import AtomResult from "@/services/bridge/atom-result.svelte";

  import TodoItem from "./todo-item/todo-item.view.svelte";
  import { todoListAtom, todosResultAtom } from "./todo-list.view-model";

  const { orgId }: { readonly orgId: OrganizationId } = $props();

  const todoList = atomValue(() => todoListAtom(orgId));
</script>

<AtomResult atom={todosResultAtom(orgId)}>
  {#snippet children(todos)}
    {#if todoList.current.isEmpty}
      <EmptyState message="No tasks yet. Add one above!" />
    {:else}
      <List gap="sm" data-testid="todo-list">
        {#each todos as todo (todo.id)}
          <List.Item>
            <TodoItem {todo} {orgId} />
          </List.Item>
        {/each}
      </List>
    {/if}
  {/snippet}
</AtomResult>
