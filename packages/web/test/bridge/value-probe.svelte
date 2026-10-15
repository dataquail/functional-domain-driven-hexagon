<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { untrack } from "svelte";

  import { atomValue } from "@/services/bridge/atom-bridge.svelte";
  import { provideRegistry } from "@/services/bridge/registry-context";

  const {
    atom,
    registry,
  }: { readonly registry: AtomRegistry.AtomRegistry; readonly atom: Atom.Atom<unknown> } = $props();

  provideRegistry({ registry: untrack(() => registry) });

  const value = atomValue(() => atom);
</script>

<output data-testid="value">{String(value.current)}</output>
