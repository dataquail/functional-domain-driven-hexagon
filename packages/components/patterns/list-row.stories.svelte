<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "../primitives/button.svelte";
  import Checkbox from "../primitives/checkbox.svelte";
  import { TrashIcon } from "../primitives/icon/icons";
  import Text from "../primitives/text.svelte";
  import ListRow from "./list-row.svelte";

  const { Story } = defineMeta({
    title: "Patterns/ListRow",
    component: ListRow,
  });
</script>

<script lang="ts">
  const row = $state({ done: false });
</script>

<Story name="A todo row" asChild>
  <ListRow revealTrailing>
    {#snippet leading()}
      <Checkbox
        checked={row.done}
        onCheckedChange={(next) => (row.done = next)}
        aria-label="Done"
      />
    {/snippet}
    <Text truncate>Water the plants</Text>
    {#snippet trailing()}
      <Button variant="ghost" size="icon" aria-label="Delete"><TrashIcon /></Button>
    {/snippet}
  </ListRow>
</Story>
