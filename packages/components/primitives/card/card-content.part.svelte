<script module lang="ts">
  import type { Snippet } from "svelte";

  export type CardContentGap = "none" | "sm" | "md" | "lg";

  const CONTENT_GAP: Record<CardContentGap, string> = {
    none: "",
    sm: "space-y-2",
    md: "space-y-3",
    lg: "space-y-4",
  };

  export type CardContentProps = {
    readonly gap?: CardContentGap;
    readonly children?: Snippet;
  };
</script>

<script lang="ts">
  const { children, gap = "none" }: CardContentProps = $props();
</script>

<div data-slot="card-content" class={["p-6 pt-0", CONTENT_GAP[gap]]}>
  {@render children?.()}
</div>
