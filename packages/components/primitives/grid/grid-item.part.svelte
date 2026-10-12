<script module lang="ts">
  import type { Snippet } from "svelte";

  import type { GridColumns } from "./grid.svelte";

  const SPAN: Record<GridColumns, string> = {
    1: "",
    2: "sm:col-span-2",
    3: "sm:col-span-3",
    4: "sm:col-span-4",
  };

  export type GridItemProps = {
    readonly spanAbove?: GridColumns;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const { children, "data-testid": testId, spanAbove = 1 }: GridItemProps = $props();
</script>

<div data-slot="grid-item" data-testid={testId} class={SPAN[spanAbove]}>
  {@render children?.()}
</div>
