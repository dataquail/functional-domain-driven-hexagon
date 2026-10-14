<script module lang="ts">
  import type { Snippet } from "svelte";

  export type GridColumns = 1 | 2 | 3 | 4;
  export type GridGap = "none" | "sm" | "md" | "lg";

  const COLUMNS_ABOVE: Record<GridColumns, string> = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
  };

  const GAP: Record<GridGap, string> = {
    none: "gap-0",
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  };

  export type GridProps = {
    readonly columnsAbove?: GridColumns;
    readonly gap?: GridGap;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const { children, columnsAbove = 2, "data-testid": testId, gap = "md" }: GridProps = $props();
</script>

<div
  data-slot="grid"
  data-testid={testId}
  class={["grid grid-cols-1", COLUMNS_ABOVE[columnsAbove], GAP[gap]]}
>
  {@render children?.()}
</div>
