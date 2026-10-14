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
  const dialog = $state({ open: false });
</script>

<Story name="Controlled" asChild>
  <Button onClick={() => (dialog.open = true)}>Delete organization</Button>
  <Dialog
    open={dialog.open}
    onOpenChange={(next) => (dialog.open = next)}
    title="Delete organization?"
    description="This cannot be undone."
  >
    The organization and every todo in it will be removed.
    {#snippet footer()}
      <Button variant="outline" onClick={() => (dialog.open = false)}>Cancel</Button>
      <Button variant="destructive" onClick={() => (dialog.open = false)}>Delete</Button>
    {/snippet}
  </Dialog>
</Story>
