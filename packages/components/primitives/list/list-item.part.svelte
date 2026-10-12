<script module lang="ts">
  import type { Snippet } from "svelte";

  export type ListItemProps = {
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const { children, "data-testid": testId }: ListItemProps = $props();
</script>

<li data-slot="list-item" data-testid={testId}>
  {@render children?.()}
</li>
