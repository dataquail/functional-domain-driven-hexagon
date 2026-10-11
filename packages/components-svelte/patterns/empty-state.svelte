<script module lang="ts">
  import type { Snippet } from "svelte";

  export type EmptyStateProps = {
    readonly message: string;
    readonly hint?: string;
    /** A call to action, e.g. a Button that opens a create form. */
    readonly action?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import Stack from "../primitives/stack.svelte";
  import Surface from "../primitives/surface.svelte";
  import Text from "../primitives/text.svelte";

  const { action, "data-testid": testId, hint, message }: EmptyStateProps = $props();
</script>

<Surface tone="muted" radius="lg" padding="lg" data-testid={testId}>
  <Stack direction="column" gap="sm" align="center">
    <Text tone="muted" align="center">{message}</Text>
    {#if hint !== undefined}
      <Text tone="muted" size="xs" align="center">{hint}</Text>
    {/if}
    {@render action?.()}
  </Stack>
</Surface>
