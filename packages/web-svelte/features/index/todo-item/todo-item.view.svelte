<script lang="ts">
  import ListRow from "@org/components-svelte/patterns/list-row.svelte";
  import Button from "@org/components-svelte/primitives/button.svelte";
  import Checkbox from "@org/components-svelte/primitives/checkbox.svelte";
  import { TrashIcon } from "@org/components-svelte/primitives/icon";
  import Label from "@org/components-svelte/primitives/label.svelte";
  import Text from "@org/components-svelte/primitives/text.svelte";
  import type { TodosContract } from "@org/contracts/api/Contracts";
  import type { OrganizationId } from "@org/contracts/EntityIds";

  import { atomSet } from "@/services/bridge/atom-bridge.svelte";

  import { deleteTodoActionAtom, toggleTodoAtom } from "./todo-item.view-model";

  const { orgId, todo }: { readonly todo: TodosContract.Todo; readonly orgId: OrganizationId } =
    $props();

  const toggle = atomSet(toggleTodoAtom);
  const remove = atomSet(deleteTodoActionAtom);
</script>

<ListRow data-testid="todo-item" revealTrailing>
  {#snippet leading()}
    <Checkbox
      id={`todo-${todo.id}`}
      checked={todo.completed}
      onCheckedChange={() => {
        toggle({ orgId, todo });
      }}
    />
  {/snippet}
  <Label
    htmlFor={`todo-${todo.id}`}
    truncate
    tone={todo.completed ? "muted" : "default"}
    decoration={todo.completed ? "line-through" : "none"}
  >
    {todo.title}
  </Label>
  {#snippet trailing()}
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        remove({ orgId, id: todo.id });
      }}
      data-testid="todo-item-delete"
    >
      <TrashIcon tone="destructive" />
      <Text as="span" srOnly>Delete</Text>
    </Button>
  {/snippet}
</ListRow>
