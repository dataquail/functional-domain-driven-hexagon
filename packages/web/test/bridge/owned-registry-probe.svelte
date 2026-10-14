<script lang="ts">
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { untrack } from "svelte";

  import { provideRegistry } from "@/services/bridge/registry-context";

  const { onRegistry }: { readonly onRegistry: (registry: AtomRegistry.AtomRegistry) => void } =
    $props();

  const registry = provideRegistry({ defaultIdleTTL: 1_000 });
  untrack(() => onRegistry)(registry);
</script>
