<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "./button.svelte";
  import Dialog from "./dialog.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Dialog",
    component: Dialog,
  });
</script>

<script lang="ts">
  let open = $state(false);
</script>

<Story name="Controlled" asChild>
  <Button onClick={() => (open = true)}>Delete organization</Button>
  <Dialog
    {open}
    onOpenChange={(next) => (open = next)}
    title="Delete organization?"
    description="This cannot be undone."
  >
    The organization and every todo in it will be removed.
    {#snippet footer()}
      <Button variant="outline" onClick={() => (open = false)}>Cancel</Button>
      <Button variant="destructive" onClick={() => (open = false)}>Delete</Button>
    {/snippet}
  </Dialog>
</Story>
