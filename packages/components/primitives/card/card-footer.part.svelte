<script module lang="ts">
  import type { Snippet } from "svelte";

  export type CardFooterProps = {
    readonly children?: Snippet;
  };
</script>

<script lang="ts">
  const { children }: CardFooterProps = $props();
</script>

<div data-slot="card-footer" class="flex items-center p-6 pt-0">
  {@render children?.()}
</div>
