<script module lang="ts">
  import type { Snippet } from "svelte";

  export type RevealProps = {
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const { children, "data-testid": testId }: RevealProps = $props();
</script>

<!-- Pairs with `Surface hoverGroup`; it never unmounts, so a screen reader can still reach it. -->
<span
  data-slot="reveal"
  data-testid={testId}
  class={[
    "opacity-0 transition-opacity",
    "group-focus-within:opacity-100 group-hover:opacity-100 focus-within:opacity-100",
  ]}
>
  {@render children?.()}
</span>
