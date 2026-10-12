<script module lang="ts">
  import type { Snippet } from "svelte";

  export type FormControlProps = {
    readonly children?: Snippet;
  };
</script>

<script lang="ts">
  const { children }: FormControlProps = $props();
</script>

<div data-slot="form-control" class="flex flex-col gap-1.5">
  {@render children?.()}
</div>
