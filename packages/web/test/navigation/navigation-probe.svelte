<script module lang="ts">
  export type NavigationProbeProps = Record<string, unknown>;
</script>

<script lang="ts">
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { untrack } from "svelte";

  import NavigationBridge from "@/services/atom/navigation-bridge.svelte";
  import { provideRegistry } from "@/services/bridge/registry-context";

  const { registry }: { readonly registry: AtomRegistry.AtomRegistry } = $props();

  provideRegistry({ registry: untrack(() => registry) });
</script>

<NavigationBridge />
