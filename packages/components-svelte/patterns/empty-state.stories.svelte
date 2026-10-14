<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "../primitives/button.svelte";
  import EmptyState from "./empty-state.svelte";

  const { Story } = defineMeta({
    title: "Patterns/EmptyState",
    component: EmptyState,
  });
</script>

<Story name="Message only" args={{ message: "No todos yet." }} />

<Story name="With a hint and an action" asChild>
  <EmptyState message="No organizations yet." hint="Create one to invite your team.">
    {#snippet action()}
      <Button size="sm">Create organization</Button>
    {/snippet}
  </EmptyState>
</Story>
