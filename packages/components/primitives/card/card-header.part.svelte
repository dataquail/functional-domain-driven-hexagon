<script module lang="ts">
  import type { Snippet } from "svelte";

  export type CardHeaderPadding = "default" | "tight";

  const HEADER_PADDING: Record<CardHeaderPadding, string> = {
    default: "p-6",
    tight: "px-6 pt-6 pb-2",
  };

  export type CardHeaderProps = {
    readonly padding?: CardHeaderPadding;
    readonly children?: Snippet;
  };
</script>

<script lang="ts">
  const { children, padding = "default" }: CardHeaderProps = $props();
</script>

<div data-slot="card-header" class={["flex flex-col gap-1.5", HEADER_PADDING[padding]]}>
  {@render children?.()}
</div>
