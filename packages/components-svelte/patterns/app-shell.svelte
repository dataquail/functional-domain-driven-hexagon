<script module lang="ts">
  import type { Snippet } from "svelte";

  export type AppShellProps = {
    readonly nav?: Snippet;
    readonly children?: Snippet;
  };
</script>

<script lang="ts">
  import Stack from "../primitives/stack.svelte";

  const { children, nav }: AppShellProps = $props();
</script>

<Stack as="main" direction="column" minHeight="screen">
  {@render nav?.()}
  <Stack direction="column" grow paddingY="lg">
    {@render children?.()}
  </Stack>
</Stack>
