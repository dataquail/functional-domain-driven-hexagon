<script module lang="ts">
  import type { Snippet } from "svelte";

  import type { ContainerWidth } from "../primitives/container.svelte";

  export type PageShellProps = {
    /** How wide the content column is allowed to get. */
    readonly width?: ContainerWidth;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import Container from "../primitives/container.svelte";
  import Stack from "../primitives/stack.svelte";

  const { children, "data-testid": testId, width = "md" }: PageShellProps = $props();
</script>

<Container {width} paddingX="md" data-testid={testId}>
  <Stack direction="column" gap="lg">
    {@render children?.()}
  </Stack>
</Container>
